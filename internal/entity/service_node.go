package entity

import "time"

const (
	NodeTypeWeb       = "web"
	NodeTypeWorker    = "worker"
	NodeTypeScheduler = "scheduler"
)

// ServiceNode stores the latest heartbeat snapshot for a running service instance.
type ServiceNode struct {
	ID              string            `json:"id" gorm:"column:id;primaryKey;size:36"`
	NodeID          string            `json:"node_id" gorm:"column:node_id;size:191;uniqueIndex:uniq_service_nodes_node_id"`
	NodeType        string            `json:"node_type" gorm:"column:node_type;size:32;index:idx_service_nodes_node_type"`
	ServiceName     string            `json:"service_name" gorm:"column:service_name;size:64"`
	DisplayName     string            `json:"display_name" gorm:"column:display_name;size:191"`
	Version         string            `json:"version" gorm:"column:version;size:64"`
	GitCommit       string            `json:"git_commit" gorm:"column:git_commit;size:64"`
	BuildTime       string            `json:"build_time" gorm:"column:build_time;size:64"`
	StartedAt       *time.Time        `json:"started_at" gorm:"column:started_at;index:idx_service_nodes_started_at"`
	LastHeartbeatAt time.Time         `json:"last_heartbeat_at" gorm:"column:last_heartbeat_at;index:idx_service_nodes_last_heartbeat_at"`
	Hostname        string            `json:"hostname" gorm:"column:hostname;size:191"`
	InstanceIP      string            `json:"instance_ip" gorm:"column:instance_ip;size:64"`
	ListenAddr      string            `json:"listen_addr" gorm:"column:listen_addr;size:64"`
	Environment     string            `json:"environment" gorm:"column:environment;size:64;index:idx_service_nodes_environment"`
	Region          string            `json:"region" gorm:"column:region;size:64"`
	Zone            string            `json:"zone" gorm:"column:zone;size:64"`
	Capabilities    []string          `json:"capabilities" gorm:"column:capabilities;serializer:json"`
	Meta            map[string]string `json:"meta" gorm:"column:meta;serializer:json"`
	CreatedAt       time.Time         `json:"created_at" gorm:"column:created_at"`
	UpdatedAt       time.Time         `json:"updated_at" gorm:"column:updated_at"`
}

// TableName specifies the database table name.
func (ServiceNode) TableName() string {
	return "service_nodes"
}
