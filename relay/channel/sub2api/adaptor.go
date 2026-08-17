package sub2api

import (
	"github.com/QuantumNous/new-api/relay/channel/newapi"
)

// Adaptor mirrors new-api-reference/relay/channel/sub2api/adaptor.go.
// It reuses the NewAPI adaptor and only overrides the channel name / model list.
type Adaptor struct {
	newapi.Adaptor
}

func (a *Adaptor) GetModelList() []string {
	return ModelList
}

func (a *Adaptor) GetChannelName() string {
	return ChannelName
}
