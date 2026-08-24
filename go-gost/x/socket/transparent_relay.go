package socket

import (
	"encoding/json"
	"fmt"
	"net"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"sync"
)

const transparentRelayTable = "tms_transparent_relay"
const transparentRelayNftFile = "tms-transparent-relay.nft"

var transparentRelayMu sync.Mutex

type transparentRelaysRequest struct {
	Rules []transparentRelayRule `json:"rules"`
}

type transparentRelayRule struct {
	ID         int64  `json:"id"`
	Name       string `json:"name"`
	EntryPort  int    `json:"entryPort"`
	TargetHost string `json:"targetHost"`
	TargetPort int    `json:"targetPort"`
	Protocol   string `json:"protocol"`
	Masquerade bool   `json:"masquerade"`
}

func (w *WebSocketReporter) handleSetTransparentRelays(data interface{}) error {
	transparentRelayMu.Lock()
	defer transparentRelayMu.Unlock()

	jsonData, err := json.Marshal(data)
	if err != nil {
		return fmt.Errorf("序列化透明中转配置失败: %v", err)
	}
	var req transparentRelaysRequest
	if err := json.Unmarshal(jsonData, &req); err != nil {
		return fmt.Errorf("解析透明中转配置失败: %v", err)
	}

	nftText, err := buildTransparentRelayNft(req.Rules)
	if err != nil {
		return err
	}

	if err := exec.Command("sysctl", "-w", "net.ipv4.ip_forward=1").Run(); err != nil {
		return fmt.Errorf("开启 IPv4 转发失败: %v", err)
	}

	path := filepath.Join(".", transparentRelayNftFile)
	if err := os.WriteFile(path, []byte(nftText), 0600); err != nil {
		return fmt.Errorf("写入透明中转 nft 配置失败: %v", err)
	}

	if out, err := exec.Command("nft", "-c", "-f", path).CombinedOutput(); err != nil {
		return fmt.Errorf("校验透明中转 nft 配置失败: %v %s", err, strings.TrimSpace(string(out)))
	}

	// 只删除 TMS 自己的 table。不存在时忽略,绝不 flush 全局 ruleset。
	_ = exec.Command("nft", "delete", "table", "ip", transparentRelayTable).Run()
	if out, err := exec.Command("nft", "-f", path).CombinedOutput(); err != nil {
		return fmt.Errorf("应用透明中转 nft 配置失败: %v %s", err, strings.TrimSpace(string(out)))
	}

	fmt.Printf("✅ 透明中转规则已应用: %d 条\n", len(req.Rules))
	return nil
}

func (w *WebSocketReporter) handleGetTransparentRelayStatus(data interface{}) (map[string]interface{}, error) {
	result := map[string]interface{}{
		"ipForward": false,
		"ruleset":   "",
	}
	if b, err := os.ReadFile("/proc/sys/net/ipv4/ip_forward"); err == nil {
		result["ipForward"] = strings.TrimSpace(string(b)) == "1"
	}
	out, err := exec.Command("nft", "list", "table", "ip", transparentRelayTable).CombinedOutput()
	if err != nil {
		msg := strings.TrimSpace(string(out))
		if msg == "" {
			msg = err.Error()
		}
		result["ruleset"] = msg
		result["exists"] = false
		return result, nil
	}
	result["ruleset"] = string(out)
	result["exists"] = true
	return result, nil
}

func buildTransparentRelayNft(rules []transparentRelayRule) (string, error) {
	var prerouting []string
	var postrouting []string

	for _, rule := range rules {
		if err := validateTransparentRelayRule(rule); err != nil {
			return "", err
		}
		protocols := transparentRelayProtocols(rule.Protocol)
		for _, proto := range protocols {
			prerouting = append(prerouting,
				fmt.Sprintf("    %s dport %d counter dnat to %s:%d", proto, rule.EntryPort, rule.TargetHost, rule.TargetPort))
			postrouting = append(postrouting,
				fmt.Sprintf("    ip daddr %s %s dport %d counter masquerade", rule.TargetHost, proto, rule.TargetPort))
		}
	}

	var b strings.Builder
	b.WriteString("table ip ")
	b.WriteString(transparentRelayTable)
	b.WriteString(" {\n")
	b.WriteString("  chain prerouting {\n")
	b.WriteString("    type nat hook prerouting priority dstnat; policy accept;\n")
	for _, line := range prerouting {
		b.WriteString(line)
		b.WriteString("\n")
	}
	b.WriteString("  }\n")
	b.WriteString("  chain postrouting {\n")
	b.WriteString("    type nat hook postrouting priority srcnat; policy accept;\n")
	for _, line := range postrouting {
		b.WriteString(line)
		b.WriteString("\n")
	}
	b.WriteString("  }\n")
	b.WriteString("}\n")
	return b.String(), nil
}

func validateTransparentRelayRule(rule transparentRelayRule) error {
	if rule.EntryPort < 1 || rule.EntryPort > 65535 {
		return fmt.Errorf("透明中转入口端口无效: %d", rule.EntryPort)
	}
	if rule.TargetPort < 1 || rule.TargetPort > 65535 {
		return fmt.Errorf("透明中转目标端口无效: %d", rule.TargetPort)
	}
	if !rule.Masquerade {
		return fmt.Errorf("透明中转第一版必须开启 masquerade")
	}
	if len(transparentRelayProtocols(rule.Protocol)) == 0 {
		return fmt.Errorf("透明中转协议无效: %s", rule.Protocol)
	}
	ip := net.ParseIP(strings.TrimSpace(rule.TargetHost))
	if ip == nil || ip.To4() == nil {
		return fmt.Errorf("透明中转目标地址只支持 IPv4: %s", rule.TargetHost)
	}
	if ip.IsLoopback() {
		return fmt.Errorf("透明中转目标不能是回环地址: %s", rule.TargetHost)
	}
	return nil
}

func transparentRelayProtocols(protocol string) []string {
	switch strings.ToLower(strings.ReplaceAll(strings.TrimSpace(protocol), "-", "_")) {
	case "tcp":
		return []string{"tcp"}
	case "udp":
		return []string{"udp"}
	case "tcp_udp", "tcpudp", "all":
		return []string{"tcp", "udp"}
	default:
		return nil
	}
}
