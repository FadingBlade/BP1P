package main

import (
	"bytes"
	"context"
	"crypto/rand"
	"encoding/base64"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"log"
	"mime"
	"net"
	"net/http"
	"net/url"
	"os"
	"path/filepath"
	"strings"
	"sync"
	"time"

	"github.com/pion/webrtc/v4"
)

type Route struct {
	Prefix string `json:"prefix"`
	Target string `json:"target"`
}
type App struct {
	ID          string  `json:"id"`
	Name        string  `json:"name"`
	Description string  `json:"description"`
	Root        string  `json:"root"`
	Routes      []Route `json:"routes"`
}
type Config struct {
	Node         struct{ ID, Name, Region, Token string } `json:"node"`
	DirectoryURL string                                   `json:"directoryUrl"`
	PublicIP     string                                   `json:"publicIp"`
	UDPPort      int                                      `json:"udpPort"`
	STUN         []string                                 `json:"stun"`
	Apps         []App                                    `json:"apps"`
}
type Wire struct {
	T       string            `json:"t"`
	ID      string            `json:"id"`
	App     string            `json:"app,omitempty"`
	Method  string            `json:"method,omitempty"`
	Path    string            `json:"path,omitempty"`
	Data    string            `json:"data,omitempty"`
	Message string            `json:"message,omitempty"`
	Status  int               `json:"status,omitempty"`
	Headers map[string]string `json:"headers,omitempty"`
	Body    string            `json:"body,omitempty"`
}
type SessionOffer struct {
	ID, AppID string
	Offer     webrtc.SessionDescription `json:"offer"`
}
type appPublic struct{ ID, Name, Description string }

var cfg Config
var apps = map[string]App{}
var api *webrtc.API
var httpClient = &http.Client{Timeout: 30 * time.Second, CheckRedirect: func(req *http.Request, via []*http.Request) error { return http.ErrUseLastResponse }}

func randomHex(n int) string {
	b := make([]byte, n)
	if _, e := rand.Read(b); e != nil {
		panic(e)
	}
	return hex.EncodeToString(b)
}
func loadIdentity() {
	statePath := os.Getenv("BP1P_STATE")
	if statePath == "" {
		statePath = "node-state.json"
	}
	var st struct {
		ID    string `json:"id"`
		Token string `json:"token"`
	}
	if b, e := os.ReadFile(statePath); e == nil {
		_ = json.Unmarshal(b, &st)
	}
	if cfg.Node.ID == "" {
		cfg.Node.ID = st.ID
	}
	if cfg.Node.Token == "" {
		cfg.Node.Token = st.Token
	}
	if cfg.Node.ID == "" {
		cfg.Node.ID = randomHex(12)
	}
	if cfg.Node.Token == "" {
		cfg.Node.Token = randomHex(24)
	}
	st.ID, st.Token = cfg.Node.ID, cfg.Node.Token
	if dir := filepath.Dir(statePath); dir != "." {
		_ = os.MkdirAll(dir, 0700)
	}
	if b, e := json.MarshalIndent(st, "", "  "); e == nil {
		_ = os.WriteFile(statePath, b, 0600)
	}
}
func loadConfig() error {
	p := os.Getenv("BP1P_CONFIG")
	if p == "" {
		p = "config.json"
	}
	b, e := os.ReadFile(p)
	if e != nil {
		return e
	}
	if e = json.Unmarshal(b, &cfg); e != nil {
		return e
	}
	loadIdentity()
	if cfg.Node.Name == "" {
		cfg.Node.Name = "BP1P Node"
	}
	if cfg.UDPPort == 0 {
		cfg.UDPPort = 8443
	}
	if cfg.DirectoryURL == "" {
		return errors.New("directoryUrl is required")
	}
	for _, a := range cfg.Apps {
		if a.ID == "" {
			return errors.New("app id required")
		}
		if a.Root != "" {
			abs, e := filepath.Abs(a.Root)
			if e != nil {
				return e
			}
			a.Root = abs
		}
		apps[a.ID] = a
	}
	return nil
}
func register() error {
	ap := make([]appPublic, 0, len(cfg.Apps))
	for _, a := range cfg.Apps {
		ap = append(ap, appPublic{a.ID, a.Name, a.Description})
	}
	body, _ := json.Marshal(map[string]any{"id": cfg.Node.ID, "name": cfg.Node.Name, "region": cfg.Node.Region, "nodeToken": cfg.Node.Token, "apps": ap})
	req, _ := http.NewRequest("POST", strings.TrimRight(cfg.DirectoryURL, "/")+"/api/nodes/register", bytes.NewReader(body))
	req.Header.Set("content-type", "application/json")
	if t := os.Getenv("BP1P_DIRECTORY_ADMIN_TOKEN"); t != "" {
		req.Header.Set("authorization", "Bearer "+t)
	}
	r, e := httpClient.Do(req)
	if e != nil {
		return e
	}
	defer r.Body.Close()
	if r.StatusCode/100 != 2 {
		x, _ := io.ReadAll(r.Body)
		return fmt.Errorf("directory registration: %s %s", r.Status, string(x))
	}
	return nil
}
func pollOffers() ([]SessionOffer, error) {
	u := fmt.Sprintf("%s/api/nodes/%s/offers", strings.TrimRight(cfg.DirectoryURL, "/"), url.PathEscape(cfg.Node.ID))
	req, _ := http.NewRequest("GET", u, nil)
	req.Header.Set("authorization", "Bearer "+cfg.Node.Token)
	r, e := httpClient.Do(req)
	if e != nil {
		return nil, e
	}
	defer r.Body.Close()
	if r.StatusCode/100 != 2 {
		return nil, fmt.Errorf("offers: %s", r.Status)
	}
	var out struct {
		Offers []SessionOffer `json:"offers"`
	}
	e = json.NewDecoder(r.Body).Decode(&out)
	return out.Offers, e
}
func postAnswer(id string, ans *webrtc.SessionDescription) error {
	b, _ := json.Marshal(map[string]any{"answer": ans})
	u := fmt.Sprintf("%s/api/sessions/%s/answer", strings.TrimRight(cfg.DirectoryURL, "/"), url.PathEscape(id))
	req, _ := http.NewRequest("POST", u, bytes.NewReader(b))
	req.Header.Set("content-type", "application/json")
	req.Header.Set("authorization", "Bearer "+cfg.Node.Token)
	r, e := httpClient.Do(req)
	if e != nil {
		return e
	}
	defer r.Body.Close()
	if r.StatusCode/100 != 2 {
		x, _ := io.ReadAll(r.Body)
		return fmt.Errorf("answer: %s %s", r.Status, string(x))
	}
	return nil
}
func sendJSON(dc *webrtc.DataChannel, mu *sync.Mutex, v any) error {
	b, e := json.Marshal(v)
	if e != nil {
		return e
	}
	mu.Lock()
	defer mu.Unlock()
	return dc.SendText(string(b))
}
func safeHeaders(h http.Header) map[string]string {
	o := map[string]string{}
	for k, vs := range h {
		lk := strings.ToLower(k)
		if lk == "connection" || lk == "transfer-encoding" || lk == "keep-alive" || lk == "proxy-authenticate" || lk == "proxy-authorization" || lk == "te" || lk == "trailer" || lk == "upgrade" {
			continue
		}
		o[k] = strings.Join(vs, ", ")
	}
	return o
}
func serveStatic(a App, m Wire) (int, map[string]string, io.ReadCloser, error) {
	if a.Root == "" {
		return 404, nil, nil, errors.New("no static root")
	}
	p := m.Path
	if q := strings.IndexByte(p, '?'); q >= 0 {
		p = p[:q]
	}
	p, _ = url.PathUnescape(p)
	p = filepath.Clean("/" + p)
	rel := strings.TrimPrefix(p, "/")
	full := filepath.Join(a.Root, rel)
	abs, e := filepath.Abs(full)
	if e != nil {
		return 500, nil, nil, e
	}
	if abs != a.Root && !strings.HasPrefix(abs, a.Root+string(os.PathSeparator)) {
		return 403, nil, nil, errors.New("path escape")
	}
	f, e := os.Open(abs)
	if e != nil {
		if os.IsNotExist(e) {
			return 404, map[string]string{"content-type": "text/plain"}, io.NopCloser(strings.NewReader("Not found")), nil
		}
		return 500, nil, nil, e
	}
	st, e := f.Stat()
	if e != nil {
		f.Close()
		return 500, nil, nil, e
	}
	if st.IsDir() {
		f.Close()
		return serveStatic(a, Wire{Path: strings.TrimSuffix(m.Path, "/") + "/index.html"})
	}
	ct := mime.TypeByExtension(filepath.Ext(abs))
	if ct == "" {
		ct = "application/octet-stream"
	}
	return 200, map[string]string{"content-type": ct, "content-length": fmt.Sprint(st.Size()), "accept-ranges": "bytes"}, f, nil
}
func matchingRoute(a App, p string) *Route {
	var best *Route
	for i := range a.Routes {
		r := &a.Routes[i]
		if strings.HasPrefix(p, r.Prefix) && (best == nil || len(r.Prefix) > len(best.Prefix)) {
			best = r
		}
	}
	return best
}
func serveRoute(a App, m Wire) (int, map[string]string, io.ReadCloser, error) {
	r := matchingRoute(a, m.Path)
	if r == nil {
		return serveStatic(a, m)
	}
	base, e := url.Parse(r.Target)
	if e != nil {
		return 500, nil, nil, e
	}
	in, e := url.Parse(m.Path)
	if e != nil {
		return 400, nil, nil, e
	}
	suffix := strings.TrimPrefix(in.Path, r.Prefix)
	base.Path = strings.TrimRight(base.Path, "/") + "/" + strings.TrimLeft(suffix, "/")
	base.RawQuery = in.RawQuery
	var body io.Reader
	if m.Body != "" {
		x, e := base64.StdEncoding.DecodeString(m.Body)
		if e != nil {
			return 400, nil, nil, e
		}
		body = bytes.NewReader(x)
	}
	req, e := http.NewRequestWithContext(context.Background(), m.Method, base.String(), body)
	if e != nil {
		return 500, nil, nil, e
	}
	for k, v := range m.Headers {
		lk := strings.ToLower(k)
		if lk == "host" || lk == "connection" || lk == "content-length" || strings.HasPrefix(lk, "proxy-") {
			continue
		}
		req.Header.Set(k, v)
	}
	resp, e := httpClient.Do(req)
	if e != nil {
		return 502, nil, nil, e
	}
	return resp.StatusCode, safeHeaders(resp.Header), resp.Body, nil
}
func handleRequest(dc *webrtc.DataChannel, mu *sync.Mutex, m Wire) {
	a, ok := apps[m.App]
	if !ok {
		_ = sendJSON(dc, mu, Wire{T: "error", ID: m.ID, Message: "unknown app"})
		return
	}
	if m.Method == "" {
		m.Method = "GET"
	}
	status, h, body, e := serveRoute(a, m)
	if e != nil {
		_ = sendJSON(dc, mu, Wire{T: "error", ID: m.ID, Message: e.Error()})
		return
	}
	if body != nil {
		defer body.Close()
	}
	if e = sendJSON(dc, mu, Wire{T: "res_start", ID: m.ID, Status: status, Headers: h}); e != nil {
		return
	}
	if m.Method != "HEAD" && body != nil {
		buf := make([]byte, 32*1024)
		for {
			n, re := body.Read(buf)
			if n > 0 {
				if sendJSON(dc, mu, Wire{T: "res_chunk", ID: m.ID, Data: base64.StdEncoding.EncodeToString(buf[:n])}) != nil {
					return
				}
			}
			if re == io.EOF {
				break
			}
			if re != nil {
				_ = sendJSON(dc, mu, Wire{T: "error", ID: m.ID, Message: re.Error()})
				return
			}
		}
	}
	_ = sendJSON(dc, mu, Wire{T: "res_end", ID: m.ID})
}
func handleOffer(s SessionOffer) {
	pc, e := api.NewPeerConnection(webrtc.Configuration{})
	if e != nil {
		log.Println("peer:", e)
		return
	}
	pc.OnConnectionStateChange(func(st webrtc.PeerConnectionState) {
		log.Printf("session %s: %s", s.ID, st)
		if st == webrtc.PeerConnectionStateFailed || st == webrtc.PeerConnectionStateClosed {
			_ = pc.Close()
		}
	})
	pc.OnDataChannel(func(dc *webrtc.DataChannel) {
		if dc.Label() != "bp1p" {
			return
		}
		var mu sync.Mutex
		dc.OnMessage(func(msg webrtc.DataChannelMessage) {
			var m Wire
			if e := json.Unmarshal(msg.Data, &m); e != nil || m.T != "req" {
				return
			}
			if m.App != s.AppID {
				_ = sendJSON(dc, &mu, Wire{T: "error", ID: m.ID, Message: "app does not match session"})
				return
			}
			go handleRequest(dc, &mu, m)
		})
	})
	if e = pc.SetRemoteDescription(s.Offer); e != nil {
		log.Println("remote description:", e)
		pc.Close()
		return
	}
	ans, e := pc.CreateAnswer(nil)
	if e != nil {
		log.Println("answer:", e)
		pc.Close()
		return
	}
	g := webrtc.GatheringCompletePromise(pc)
	if e = pc.SetLocalDescription(ans); e != nil {
		log.Println("local description:", e)
		pc.Close()
		return
	}
	<-g
	if e = postAnswer(s.ID, pc.LocalDescription()); e != nil {
		log.Println(e)
		pc.Close()
	}
}
func main() {
	if e := loadConfig(); e != nil {
		log.Fatal(e)
	}
	udp, e := net.ListenUDP("udp", &net.UDPAddr{IP: net.IPv4zero, Port: cfg.UDPPort})
	if e != nil {
		log.Fatal(e)
	}
	se := webrtc.SettingEngine{}
	se.SetICEUDPMux(webrtc.NewICEUDPMux(nil, udp))
	if cfg.PublicIP != "" {
		if e := se.SetICEAddressRewriteRules(webrtc.ICEAddressRewriteRule{External: []string{cfg.PublicIP}, AsCandidateType: webrtc.ICECandidateTypeHost, Mode: webrtc.ICEAddressRewriteReplace}); e != nil {
			log.Fatal(e)
		}
	}
	api = webrtc.NewAPI(webrtc.WithSettingEngine(se))
	log.Printf("BP1P node %s (%s), UDP :%d", cfg.Node.Name, cfg.Node.ID, cfg.UDPPort)
	ticker := time.NewTicker(15 * time.Second)
	defer ticker.Stop()
	for {
		if e := register(); e != nil {
			log.Println("register:", e)
		}
		offers, e := pollOffers()
		if e != nil {
			log.Println("poll:", e)
		} else {
			for _, s := range offers {
				go handleOffer(s)
			}
		}
		select {
		case <-ticker.C:
		case <-time.After(2 * time.Second):
		}
	}
}
