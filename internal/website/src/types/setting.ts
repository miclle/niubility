// Setting represents a key-value configuration entry.
export interface Setting {
  key: string
  value: string
  updated_at: string
}

// ListSettingsResponse represents the response for listing settings.
export interface ListSettingsResponse {
  settings: Setting[]
}

// UpdateSettingsRequest represents the request body for updating settings.
export interface UpdateSettingsRequest {
  settings: Record<string, string>
}

// WechatSettings represents the WeChat Work configuration form data.
export interface WechatSettings {
  corp_id: string
  app_agentid: string
  app_secret: string
}

// S3Settings represents the S3 storage configuration form data.
export interface S3Settings {
  endpoint: string
  region: string
  bucket: string
  access_key: string
  secret_key: string
  public_url: string
}
