package service

import (
	"errors"

	"github.com/QuantumNous/new-api/model"
)

// ErrChannelRequestGuardRejected is intentionally safe for relay callers: it
// reveals neither channel credentials nor durable guard/source payloads.
var ErrChannelRequestGuardRejected = errors.New("channel unavailable")

type channelRequestGuardError struct{ cause error }

func (e *channelRequestGuardError) Error() string { return ErrChannelRequestGuardRejected.Error() }
func (e *channelRequestGuardError) Unwrap() error { return ErrChannelRequestGuardRejected }

// ChannelRequestGuardCause is for internal logs only. User-facing callers
// should use IsChannelRequestGuardRejected and return the safe error message.
func ChannelRequestGuardCause(err error) error {
	var rejected *channelRequestGuardError
	if errors.As(err, &rejected) {
		return rejected.cause
	}
	return nil
}

func IsChannelRequestGuardRejected(err error) bool {
	return errors.Is(err, ErrChannelRequestGuardRejected)
}

func rejectChannelRequestGuard(cause error) error { return &channelRequestGuardError{cause: cause} }

// AuthorizeChannelForUserRequest is called immediately before a user request
// reads a channel key or contacts an upstream. Internal probes simply do not
// call this function; no bypass is embedded in key selection.
//
// 方案 E 适配：通过 GetPendingAutoPriceGuardByChannel 查询替代
// 新版的 channel.AutoPriceGuardID 指针检查。
func AuthorizeChannelForUserRequest(channel *model.Channel) error {
	if channel == nil {
		return rejectChannelRequestGuard(errors.New("missing channel"))
	}
	// 方案 E：查询 pending guard 替代 AutoPriceGuardID 指针
	guard, err := model.GetPendingAutoPriceGuardByChannel(channel.Id)
	if err != nil {
		return rejectChannelRequestGuard(err)
	}
	if guard == nil {
		return nil
	}
	// 找到 pending guard，执行 CAS 标记为 used
	result, err := model.UseChannelAutoPriceGuardCAS(guard.ID, channel.Id)
	if err != nil {
		return rejectChannelRequestGuard(err)
	}
	if !result.Found || !result.OwnerMatched {
		return rejectChannelRequestGuard(errors.New("guard unavailable"))
	}
	switch result.State {
	case model.AutoPriceGuardStateUsed, model.AutoPriceGuardStateInvalidated, model.AutoPriceGuardStateResolved:
		return nil
	default:
		return rejectChannelRequestGuard(errors.New("guard state unavailable"))
	}
}
