package content

import "testing"

func TestAttachmentAccessURL(t *testing.T) {
	tests := []struct {
		name string
		key  string
		want string
	}{
		{name: "raw key", key: "abc.png", want: "/attachments/abc.png"},
		{name: "already absolute path", key: "/attachments/abc.png", want: "/attachments/abc.png"},
		{name: "empty key", key: "", want: ""},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if got := attachmentAccessURL(tt.key); got != tt.want {
				t.Fatalf("attachmentAccessURL(%q) = %q, want %q", tt.key, got, tt.want)
			}
		})
	}
}

func TestReplaceImageURLs(t *testing.T) {
	bodyHTML := `<p><img src="./cover.png" alt="cover"></p>`
	imageURLMap := map[string]string{
		"./cover.png": "/attachments/abc.png",
	}

	got := replaceImageURLs(bodyHTML, imageURLMap)
	want := `<p><img src="/attachments/abc.png" alt="cover"></p>`
	if got != want {
		t.Fatalf("replaceImageURLs() = %q, want %q", got, want)
	}
}
