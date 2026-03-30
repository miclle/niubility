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

func TestBuildQiniuDeliveryURL(t *testing.T) {
	cfg := &entity.DeliveryConfig{
		Provider:       "qiniu",
		Domain:         "https://img.example.com",
		PrivateEnabled: true,
		URLTTLSeconds:  3600,
		SignKey:        "test-ak",
		SignSecret:     "test-sk",
	}

	got, err := buildQiniuDeliveryURL(cfg, "avatars/demo.png", "imageView2/1/w/100/h/100")
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
