package service

import (
	"strings"
	"testing"

	"github.com/miclle/niubility/internal/entity"
)

func TestAppendRawQuery(t *testing.T) {
	tests := []struct {
		name     string
		rawURL   string
		rawQuery string
		want     string
	}{
		{
			name:     "empty query keeps original url",
			rawURL:   "https://cdn.example.com/attachments/demo.png",
			rawQuery: "",
			want:     "https://cdn.example.com/attachments/demo.png",
		},
		{
			name:     "appends raw style query",
			rawURL:   "https://cdn.example.com/attachments/demo.png",
			rawQuery: "imageView2/1/w/320/h/180",
			want:     "https://cdn.example.com/attachments/demo.png?imageView2/1/w/320/h/180",
		},
		{
			name:     "appends to existing query string",
			rawURL:   "https://cdn.example.com/attachments/demo.png?foo=bar",
			rawQuery: "x-oss-process=image/resize,w_320",
			want:     "https://cdn.example.com/attachments/demo.png?foo=bar&x-oss-process=image/resize,w_320",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := appendRawQuery(tt.rawURL, tt.rawQuery)
			if got != tt.want {
				t.Fatalf("appendRawQuery() = %q, want %q", got, tt.want)
			}
		})
	}
}

func TestExtractStyleRequest(t *testing.T) {
	tests := []struct {
		name            string
		rawQuery        string
		wantStyle       string
		wantPassthrough string
	}{
		{
			name:            "style query is extracted",
			rawQuery:        "style=imageView2%2F1%2Fw%2F320%2Fh%2F180&foo=bar",
			wantStyle:       "imageView2/1/w/320/h/180",
			wantPassthrough: "foo=bar",
		},
		{
			name:            "legacy raw fragment is treated as style",
			rawQuery:        "imageView2/1/w/320/h/180",
			wantStyle:       "imageView2/1/w/320/h/180",
			wantPassthrough: "",
		},
		{
			name:            "named style is extracted",
			rawQuery:        "style=gallery-card",
			wantStyle:       "gallery-card",
			wantPassthrough: "",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			gotStyle, gotPassthrough := extractStyleRequest(tt.rawQuery)
			if gotStyle != tt.wantStyle {
				t.Fatalf("extractStyleRequest() style = %q, want %q", gotStyle, tt.wantStyle)
			}
			if gotPassthrough != tt.wantPassthrough {
				t.Fatalf("extractStyleRequest() passthrough = %q, want %q", gotPassthrough, tt.wantPassthrough)
			}
		})
	}
}

func TestBuildGenericAssetURL(t *testing.T) {
	tests := []struct {
		name     string
		baseURL  string
		rawQuery string
		want     string
	}{
		{
			name:     "style parameter with raw query is expanded",
			baseURL:  "https://cdn.example.com/attachments/demo.png",
			rawQuery: "style=imageView2%2F1%2Fw%2F320%2Fh%2F180",
			want:     "https://cdn.example.com/attachments/demo.png?imageView2/1/w/320/h/180",
		},
		{
			name:     "named style is preserved as style parameter in generic mode",
			baseURL:  "https://cdn.example.com/attachments/demo.png",
			rawQuery: "style=gallery-card",
			want:     "https://cdn.example.com/attachments/demo.png?style=gallery-card",
		},
		{
			name:     "passthrough query is kept",
			baseURL:  "https://cdn.example.com/attachments/demo.png",
			rawQuery: "style=imageView2%2F2%2Fw%2F960&download=1",
			want:     "https://cdn.example.com/attachments/demo.png?attname=download&imageView2/2/w/960",
		},
		{
			name:     "download filename is translated to attname",
			baseURL:  "https://cdn.example.com/attachments/demo.png",
			rawQuery: "download=demo.png",
			want:     "https://cdn.example.com/attachments/demo.png?attname=demo.png",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := buildGenericAssetURL(tt.baseURL, tt.rawQuery)
			if got != tt.want {
				t.Fatalf("buildGenericAssetURL() = %q, want %q", got, tt.want)
			}
		})
	}
}

func TestBuildQiniuDeliveryURL(t *testing.T) {
	deliveryCfg := &entity.DeliveryConfig{
		Provider:       "qiniu",
		Domain:         "https://img.example.com",
		PrivateEnabled: true,
		URLTTLSeconds:  3600,
	}
	s3Cfg := &entity.S3Config{
		AccessKey: "test-ak",
		SecretKey: "test-sk",
	}

	got, err := buildQiniuDeliveryURL(deliveryCfg, s3Cfg, "avatars/demo.png", "imageView2/1/w/100/h/100")
	if err != nil {
		t.Fatalf("buildQiniuDeliveryURL() error = %v", err)
	}
	if !strings.HasPrefix(got, "https://img.example.com/avatars/demo.png?imageView2/1/w/100/h/100") {
		t.Fatalf("buildQiniuDeliveryURL() prefix = %q", got)
	}
	if !strings.Contains(got, "&e=") {
		t.Fatalf("buildQiniuDeliveryURL() missing e in %q", got)
	}
	if !strings.Contains(got, "&token=test-ak%3A") {
		t.Fatalf("buildQiniuDeliveryURL() missing token in %q", got)
	}
}

func TestBuildQiniuDeliveryURL_WithNamedStyle(t *testing.T) {
	deliveryCfg := &entity.DeliveryConfig{
		Provider:       "qiniu",
		Domain:         "https://img.example.com",
		PrivateEnabled: false,
		URLTTLSeconds:  3600,
	}
	s3Cfg := &entity.S3Config{
		AccessKey: "test-ak",
		SecretKey: "test-sk",
	}

	got, err := buildQiniuDeliveryURL(deliveryCfg, s3Cfg, "attachments/demo.png", "style=gallery-card")
	if err != nil {
		t.Fatalf("buildQiniuDeliveryURL() error = %v", err)
	}
	if got != "https://img.example.com/attachments/demo.png-gallery-card" {
		t.Fatalf("buildQiniuDeliveryURL() = %q", got)
	}
}
