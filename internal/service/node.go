package service

import (
	"context"
	"errors"
	"fmt"
	"net"
	"os"
	"sort"
	"strings"
	"time"

	"gorm.io/gorm"

	"github.com/miclle/niubility/internal/entity"
)

const (
	ServiceNodeStatusOnline  = "online"
	ServiceNodeStatusOffline = "offline"
)

// ServiceNodeHeartbeatInput contains the latest heartbeat snapshot for a node.
type ServiceNodeHeartbeatInput struct {
	NodeID       string
	NodeType     string
	ServiceName  string
	DisplayName  string
	Version      string
	GitCommit    string
	BuildTime    string
	StartedAt    *time.Time
	Hostname     string
	InstanceIP   string
	ListenAddr   string
	Environment  string
	Region       string
	Zone         string
	Capabilities []string
	Meta         map[string]string
}

// ListServiceNodesInput contains admin list filters.
type ListServiceNodesInput struct {
	NodeType string
}

// AdminServiceNode is the admin-facing node payload.
type AdminServiceNode struct {
	ID              string            `json:"id"`
	NodeID          string            `json:"node_id"`
	NodeType        string            `json:"node_type"`
	ServiceName     string            `json:"service_name"`
	DisplayName     string            `json:"display_name"`
	Status          string            `json:"status"`
	Version         string            `json:"version"`
	GitCommit       string            `json:"git_commit"`
	BuildTime       string            `json:"build_time"`
	StartedAt       *time.Time        `json:"started_at"`
	LastHeartbeatAt time.Time         `json:"last_heartbeat_at"`
	Hostname        string            `json:"hostname"`
	InstanceIP      string            `json:"instance_ip"`
	ListenAddr      string            `json:"listen_addr"`
	Environment     string            `json:"environment"`
	Region          string            `json:"region"`
	Zone            string            `json:"zone"`
	Capabilities    []string          `json:"capabilities"`
	Meta            map[string]string `json:"meta"`
	UptimeSeconds   int64             `json:"uptime_seconds"`
}

// ServiceNodeListSummary is the summary payload for admin list page.
type ServiceNodeListSummary struct {
	OnlineCount  int64            `json:"online_count"`
	OfflineCount int64            `json:"offline_count"`
	TypeCounts   map[string]int64 `json:"type_counts"`
	VersionDrift bool             `json:"version_drift"`
}

// ServiceNodeListResult is the admin list response.
type ServiceNodeListResult struct {
	OnlineItems  []AdminServiceNode     `json:"online_items"`
	OfflineItems []AdminServiceNode     `json:"offline_items"`
	Summary      ServiceNodeListSummary `json:"summary"`
}

// CurrentNodeConfig describes the current process for periodic node reporting.
type CurrentNodeConfig struct {
	NodeID            string
	NodeType          string
	ServiceName       string
	DisplayName       string
	Version           string
	GitCommit         string
	BuildTime         string
	ListenAddr        string
	Environment       string
	Region            string
	Zone              string
	Capabilities      []string
	Meta              map[string]string
	HeartbeatInterval time.Duration
}

// UpsertServiceNodeHeartbeat records the latest heartbeat for a node.
func (s *Service) UpsertServiceNodeHeartbeat(ctx context.Context, input ServiceNodeHeartbeatInput) error {
	nodeID := strings.TrimSpace(input.NodeID)
	if nodeID == "" {
		return fmt.Errorf("node_id is required")
	}

	nodeType := strings.TrimSpace(input.NodeType)
	if nodeType == "" {
		nodeType = entity.NodeTypeWeb
	}

	serviceName := strings.TrimSpace(input.ServiceName)
	if serviceName == "" {
		serviceName = "niubility"
	}

	now := s.now()
	var node entity.ServiceNode
	err := s.db.WithContext(ctx).Where("node_id = ?", nodeID).First(&node).Error
	if err != nil && !errors.Is(err, gorm.ErrRecordNotFound) {
		return fmt.Errorf("query service node: %w", err)
	}

	if errors.Is(err, gorm.ErrRecordNotFound) {
		node = entity.ServiceNode{
			ID: nodeIDToEntityID(nodeID),
		}
	}

	node.NodeID = nodeID
	node.NodeType = nodeType
	node.ServiceName = serviceName
	node.DisplayName = strings.TrimSpace(input.DisplayName)
	node.Version = strings.TrimSpace(input.Version)
	node.GitCommit = strings.TrimSpace(input.GitCommit)
	node.BuildTime = strings.TrimSpace(input.BuildTime)
	node.StartedAt = input.StartedAt
	node.Hostname = strings.TrimSpace(input.Hostname)
	node.InstanceIP = strings.TrimSpace(input.InstanceIP)
	node.ListenAddr = strings.TrimSpace(input.ListenAddr)
	node.Environment = strings.TrimSpace(input.Environment)
	node.Region = strings.TrimSpace(input.Region)
	node.Zone = strings.TrimSpace(input.Zone)
	node.Capabilities = append([]string(nil), input.Capabilities...)
	node.Meta = cloneStringMap(input.Meta)
	node.LastHeartbeatAt = now

	if errors.Is(err, gorm.ErrRecordNotFound) {
		if node.ID == "" {
			node.ID = entity.ID()
		}
		if err := s.db.WithContext(ctx).Create(&node).Error; err != nil {
			return fmt.Errorf("create service node: %w", err)
		}
		return nil
	}

	if err := s.db.WithContext(ctx).Save(&node).Error; err != nil {
		return fmt.Errorf("update service node: %w", err)
	}
	return nil
}

// ListServiceNodes returns grouped service nodes for the admin page.
func (s *Service) ListServiceNodes(ctx context.Context, input ListServiceNodesInput) (*ServiceNodeListResult, error) {
	query := s.db.WithContext(ctx).Model(&entity.ServiceNode{})
	if nodeType := strings.TrimSpace(input.NodeType); nodeType != "" {
		query = query.Where("node_type = ?", nodeType)
	}

	var nodes []entity.ServiceNode
	if err := query.Order("last_heartbeat_at DESC").Find(&nodes).Error; err != nil {
		return nil, fmt.Errorf("list service nodes: %w", err)
	}

	result := &ServiceNodeListResult{
		OnlineItems:  make([]AdminServiceNode, 0),
		OfflineItems: make([]AdminServiceNode, 0),
		Summary: ServiceNodeListSummary{
			TypeCounts: make(map[string]int64),
		},
	}

	versionSet := make(map[string]struct{})
	for _, node := range nodes {
		item := s.toAdminServiceNode(node)
		result.Summary.TypeCounts[item.NodeType]++
		if item.Status == ServiceNodeStatusOnline {
			result.OnlineItems = append(result.OnlineItems, item)
			result.Summary.OnlineCount++
			versionSet[versionKey(item.Version, item.GitCommit)] = struct{}{}
		} else {
			result.OfflineItems = append(result.OfflineItems, item)
			result.Summary.OfflineCount++
		}
	}
	result.Summary.VersionDrift = len(versionSet) > 1

	sort.SliceStable(result.OnlineItems, func(i, j int) bool {
		return result.OnlineItems[i].LastHeartbeatAt.After(result.OnlineItems[j].LastHeartbeatAt)
	})
	sort.SliceStable(result.OfflineItems, func(i, j int) bool {
		return result.OfflineItems[i].LastHeartbeatAt.After(result.OfflineItems[j].LastHeartbeatAt)
	})

	return result, nil
}

// StartCurrentNodeHeartbeat reports the current process state immediately and on an interval.
func (s *Service) StartCurrentNodeHeartbeat(ctx context.Context, cfg CurrentNodeConfig) {
	nodeID := strings.TrimSpace(cfg.NodeID)
	if nodeID == "" {
		return
	}

	interval := cfg.HeartbeatInterval
	if interval <= 0 {
		interval = 30 * time.Second
	}

	startedAt := s.now()
	hostname, _ := os.Hostname()
	if strings.TrimSpace(cfg.DisplayName) == "" {
		cfg.DisplayName = nodeID
	}
	if strings.TrimSpace(cfg.ServiceName) == "" {
		cfg.ServiceName = "niubility"
	}
	if strings.TrimSpace(cfg.NodeType) == "" {
		cfg.NodeType = entity.NodeTypeWeb
	}

	report := func() {
		_ = s.UpsertServiceNodeHeartbeat(context.Background(), ServiceNodeHeartbeatInput{
			NodeID:       cfg.NodeID,
			NodeType:     cfg.NodeType,
			ServiceName:  cfg.ServiceName,
			DisplayName:  cfg.DisplayName,
			Version:      cfg.Version,
			GitCommit:    cfg.GitCommit,
			BuildTime:    cfg.BuildTime,
			StartedAt:    &startedAt,
			Hostname:     hostname,
			InstanceIP:   detectPrimaryIP(),
			ListenAddr:   cfg.ListenAddr,
			Environment:  cfg.Environment,
			Region:       cfg.Region,
			Zone:         cfg.Zone,
			Capabilities: cfg.Capabilities,
			Meta:         cloneStringMap(cfg.Meta),
		})
	}

	report()
	s.asyncRunner(func() {
		ticker := time.NewTicker(interval)
		defer ticker.Stop()
		for {
			select {
			case <-ctx.Done():
				return
			case <-ticker.C:
				report()
			}
		}
	})
}

func (s *Service) toAdminServiceNode(node entity.ServiceNode) AdminServiceNode {
	now := s.now()
	status := ServiceNodeStatusOffline
	if now.Sub(node.LastHeartbeatAt) <= s.nodeHeartbeatTimeout {
		status = ServiceNodeStatusOnline
	}

	var uptimeSeconds int64
	if node.StartedAt != nil {
		uptimeSeconds = int64(now.Sub(*node.StartedAt).Seconds())
		if uptimeSeconds < 0 {
			uptimeSeconds = 0
		}
	}

	return AdminServiceNode{
		ID:              node.ID,
		NodeID:          node.NodeID,
		NodeType:        node.NodeType,
		ServiceName:     node.ServiceName,
		DisplayName:     node.DisplayName,
		Status:          status,
		Version:         node.Version,
		GitCommit:       node.GitCommit,
		BuildTime:       node.BuildTime,
		StartedAt:       node.StartedAt,
		LastHeartbeatAt: node.LastHeartbeatAt,
		Hostname:        node.Hostname,
		InstanceIP:      node.InstanceIP,
		ListenAddr:      node.ListenAddr,
		Environment:     node.Environment,
		Region:          node.Region,
		Zone:            node.Zone,
		Capabilities:    append([]string(nil), node.Capabilities...),
		Meta:            cloneStringMap(node.Meta),
		UptimeSeconds:   uptimeSeconds,
	}
}

func versionKey(version, gitCommit string) string {
	return strings.TrimSpace(version) + "|" + strings.TrimSpace(gitCommit)
}

func cloneStringMap(src map[string]string) map[string]string {
	if len(src) == 0 {
		return nil
	}
	dst := make(map[string]string, len(src))
	for k, v := range src {
		dst[k] = v
	}
	return dst
}

func nodeIDToEntityID(nodeID string) string {
	if nodeID == "" {
		return entity.ID()
	}
	return entity.ID()
}

func detectPrimaryIP() string {
	addrs, err := net.InterfaceAddrs()
	if err != nil {
		return ""
	}
	for _, addr := range addrs {
		ipNet, ok := addr.(*net.IPNet)
		if !ok || ipNet.IP == nil || ipNet.IP.IsLoopback() {
			continue
		}
		if ip4 := ipNet.IP.To4(); ip4 != nil {
			return ip4.String()
		}
	}
	return ""
}
