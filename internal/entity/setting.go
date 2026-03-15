package entity

import "time"

// Setting represents a key-value configuration entry stored in the database.
// This allows dynamic configuration management without modifying YAML files.
type Setting struct {
	Key       string    `json:"key"        gorm:"column:key;primaryKey;size:64"`
	Value     string    `json:"value"      gorm:"column:value;type:text"`
	UpdatedAt time.Time `json:"updated_at" gorm:"column:updated_at"`
}

// TableName specifies the database table name for Setting.
func (Setting) TableName() string {
	return "settings"
}

// Setting key constants for WeChat configuration.
const (
	SettingWechatCorpID     = "wechat.corp_id"
	SettingWechatAppAgentID = "wechat.app_agentid"
	SettingWechatAppSecret  = "wechat.app_secret"
)

// WechatConfig represents the WeChat Work configuration extracted from settings.
type WechatConfig struct {
	CorpID     string
	AppAgentID int64
	AppSecret  string
}
