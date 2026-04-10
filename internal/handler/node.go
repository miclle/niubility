package handler

import (
	"github.com/fox-gonic/fox"

	"github.com/miclle/niubility/internal/service"
)

// ListServiceNodesArgs represents the query parameters for the admin node list.
type ListServiceNodesArgs struct {
	NodeType string `form:"node_type"`
}

// ListServiceNodes returns grouped service nodes for the admin page.
func (ctrl *Ctrl) ListServiceNodes(c *fox.Context, args ListServiceNodesArgs) (*service.ServiceNodeListResult, error) {
	ctx := c.Logger.WithContext(c.Request.Context())
	return ctrl.service.ListServiceNodes(ctx, service.ListServiceNodesInput{
		NodeType: args.NodeType,
	})
}
