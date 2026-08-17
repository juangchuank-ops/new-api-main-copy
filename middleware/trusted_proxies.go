package middleware

import (
	"errors"
	"fmt"
	"log"
	"os"
	"strings"

	"github.com/gin-gonic/gin"
)

// defaultTrustedProxyCIDRs is the fallback list used when TRUSTED_PROXIES is
// unset or blank. It trusts loopback, RFC 1918, and IPv6 ULA proxy addresses
// for backwards compatibility.
var defaultTrustedProxyCIDRs = []string{
	"127.0.0.0/8",
	"::1",
	"10.0.0.0/8",
	"172.16.0.0/12",
	"192.168.0.0/16",
	"fc00::/7",
}

// ConfigureTrustedProxies configures gin's trusted proxy list based on the
// TRUSTED_PROXIES environment variable. Mirrors
// new-api-reference/middleware/trusted_proxies.go.
//
// Accepted values:
//   - "" / unset: trust the default CIDRs (loopback, RFC1918, IPv6 ULA)
//   - "none": trust no proxies (all X-Forwarded-* headers ignored)
//   - "ip1,ip2,cidr1,...": trust exactly the listed IPs/CIDRs
func ConfigureTrustedProxies(engine *gin.Engine) error {
	rawTrustedProxies := strings.TrimSpace(os.Getenv("TRUSTED_PROXIES"))
	if rawTrustedProxies == "" {
		log.Print("WARNING: TRUSTED_PROXIES is unset or blank; trusting loopback, RFC 1918, and IPv6 ULA proxy addresses for compatibility. Set TRUSTED_PROXIES=none to trust no proxies, or configure explicit proxy IPs/CIDRs to replace these defaults.")
		return engine.SetTrustedProxies(defaultTrustedProxyCIDRs)
	}
	if strings.EqualFold(rawTrustedProxies, "none") {
		return engine.SetTrustedProxies(nil)
	}

	parts := strings.Split(rawTrustedProxies, ",")
	trustedProxies := make([]string, 0, len(parts))
	for _, part := range parts {
		trustedProxy := strings.TrimSpace(part)
		if trustedProxy == "" {
			continue
		}
		if strings.EqualFold(trustedProxy, "none") {
			return errors.New("TRUSTED_PROXIES=none must be used alone")
		}
		trustedProxies = append(trustedProxies, trustedProxy)
	}
	if len(trustedProxies) == 0 {
		return errors.New("TRUSTED_PROXIES does not contain an IP address or CIDR")
	}
	if err := engine.SetTrustedProxies(trustedProxies); err != nil {
		return fmt.Errorf("invalid TRUSTED_PROXIES: %w", err)
	}
	return nil
}
