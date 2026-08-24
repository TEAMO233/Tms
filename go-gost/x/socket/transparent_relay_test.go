package socket

import (
	"strings"
	"testing"
)

func TestBuildTransparentRelayNftTcpUdp(t *testing.T) {
	nft, err := buildTransparentRelayNft([]transparentRelayRule{{
		ID: 1, EntryPort: 1000, TargetHost: "140.245.126.119", TargetPort: 20000,
		Protocol: "tcp_udp", Masquerade: true,
	}})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	for _, want := range []string{
		"tcp dport 1000 counter dnat to 140.245.126.119:20000",
		"udp dport 1000 counter dnat to 140.245.126.119:20000",
		"ip daddr 140.245.126.119 tcp dport 20000 counter masquerade",
		"ip daddr 140.245.126.119 udp dport 20000 counter masquerade",
	} {
		if !strings.Contains(nft, want) {
			t.Fatalf("nft output missing %q\n%s", want, nft)
		}
	}
}

func TestBuildTransparentRelayNftSingleProtocol(t *testing.T) {
	nft, err := buildTransparentRelayNft([]transparentRelayRule{{
		ID: 1, EntryPort: 1001, TargetHost: "140.245.126.119", TargetPort: 20001,
		Protocol: "tcp", Masquerade: true,
	}})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if !strings.Contains(nft, "tcp dport 1001 counter dnat") {
		t.Fatalf("missing tcp dnat: %s", nft)
	}
	if strings.Contains(nft, "udp dport 1001 counter dnat") {
		t.Fatalf("unexpected udp dnat: %s", nft)
	}
}

func TestBuildTransparentRelayNftEmptyRules(t *testing.T) {
	nft, err := buildTransparentRelayNft(nil)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if !strings.Contains(nft, "table ip tms_transparent_relay") {
		t.Fatalf("missing table: %s", nft)
	}
	if strings.Contains(nft, "dnat to") {
		t.Fatalf("empty rules should not contain dnat: %s", nft)
	}
}

func TestBuildTransparentRelayNftRejectsInvalidInput(t *testing.T) {
	cases := []transparentRelayRule{
		{EntryPort: 0, TargetHost: "140.245.126.119", TargetPort: 20000, Protocol: "tcp", Masquerade: true},
		{EntryPort: 1000, TargetHost: "127.0.0.1", TargetPort: 20000, Protocol: "tcp", Masquerade: true},
		{EntryPort: 1000, TargetHost: "node.example.com", TargetPort: 20000, Protocol: "tcp", Masquerade: true},
		{EntryPort: 1000, TargetHost: "140.245.126.119", TargetPort: 70000, Protocol: "tcp", Masquerade: true},
		{EntryPort: 1000, TargetHost: "140.245.126.119", TargetPort: 20000, Protocol: "icmp", Masquerade: true},
		{EntryPort: 1000, TargetHost: "140.245.126.119", TargetPort: 20000, Protocol: "tcp", Masquerade: false},
	}
	for _, tc := range cases {
		if _, err := buildTransparentRelayNft([]transparentRelayRule{tc}); err == nil {
			t.Fatalf("expected error for %+v", tc)
		}
	}
}
