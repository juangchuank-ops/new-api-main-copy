package controller

import (
	"errors"
	"fmt"
	"net/http"
	"strconv"
	"strings"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/i18n"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/oauth"
	"github.com/gin-contrib/sessions"
	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

// providerParams returns map with Provider key for i18n templates
func providerParams(name string) map[string]any {
	return map[string]any{"Provider": name}
}

// GenerateOAuthCode generates a state code for OAuth CSRF protection
func GenerateOAuthCode(c *gin.Context) {
	session := sessions.Default(c)
	state := common.GetRandomString(12)
	affCode := c.Query("aff")
	if affCode != "" {
		session.Set("aff", affCode)
	}
	invCode := c.Query("invitation_code")
	if invCode != "" {
		session.Set("invitation_code", invCode)
	}
	session.Set("oauth_state", state)
	err := session.Save()
	if err != nil {
		common.ApiError(c, err)
		return
	}
	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "",
		"data":    state,
	})
}

// HandleOAuth handles OAuth callback for all standard OAuth providers
func HandleOAuth(c *gin.Context) {
	providerName := c.Param("provider")
	provider := oauth.GetProvider(providerName)
	if provider == nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"message": i18n.T(c, i18n.MsgOAuthUnknownProvider),
		})
		return
	}

	session := sessions.Default(c)

	// 1. Validate state (CSRF protection)
	state := c.Query("state")
	if state == "" || session.Get("oauth_state") == nil || state != session.Get("oauth_state").(string) {
		c.JSON(http.StatusForbidden, gin.H{
			"success": false,
			"message": i18n.T(c, i18n.MsgOAuthStateInvalid),
		})
		return
	}

	// 2. Check if user is already logged in (bind flow)
	username := session.Get("username")
	if username != nil {
		handleOAuthBind(c, provider)
		return
	}

	// 3. Check if provider is enabled
	if !provider.IsEnabled() {
		common.ApiErrorI18n(c, i18n.MsgOAuthNotEnabled, providerParams(provider.GetName()))
		return
	}

	// 4. Handle error from provider
	errorCode := c.Query("error")
	if errorCode != "" {
		errorDescription := c.Query("error_description")
		c.JSON(http.StatusOK, gin.H{
			"success": false,
			"message": errorDescription,
		})
		return
	}

	// 5. Exchange code for token
	code := c.Query("code")
	token, err := provider.ExchangeToken(c.Request.Context(), code, c)
	if err != nil {
		handleOAuthError(c, err)
		return
	}

	// 6. Get user info
	oauthUser, err := provider.GetUserInfo(c.Request.Context(), token)
	if err != nil {
		handleOAuthError(c, err)
		return
	}

	// 7. Find or create user
	user, err := findOrCreateOAuthUser(c, provider, oauthUser, session)
	if err != nil {
		switch err.(type) {
		case *OAuthUserDeletedError:
			common.ApiErrorI18n(c, i18n.MsgOAuthUserDeleted)
		case *OAuthRegistrationDisabledError:
			common.ApiErrorI18n(c, i18n.MsgUserRegisterDisabled)
		case *OAuthInvitationCodeRequiredError:
			// Return special response so frontend can show invitation code dialog
			session.Set("pending_oauth_provider", providerName)
			session.Set("pending_oauth_user_id", oauthUser.ProviderUserID)
			session.Set("pending_oauth_username", oauthUser.Username)
			session.Set("pending_oauth_display_name", oauthUser.DisplayName)
			session.Set("pending_oauth_email", oauthUser.Email)
			if err := session.Save(); err != nil {
				common.SysError(fmt.Sprintf("[OAuth] Failed to save pending OAuth session: %s", err.Error()))
			}
			c.JSON(http.StatusOK, gin.H{
				"success":                  false,
				"invitation_code_required": true,
				"provider":                 provider.GetName(),
			})
			return
		case *OAuthInvitationCodeInvalidError:
			common.ApiErrorI18n(c, i18n.MsgOAuthInvitationCodeInvalid)
		default:
			common.ApiError(c, err)
		}
		return
	}

	// 8. Check user status
	if user.Status != common.UserStatusEnabled {
		common.ApiErrorI18n(c, i18n.MsgOAuthUserBanned)
		return
	}

	// 9. Setup login
	setupLogin(user, c)
}

// CompleteOAuthRegistration completes OAuth registration with an invitation code.
// Called by the frontend after the user inputs an invitation code.
func CompleteOAuthRegistration(c *gin.Context) {
	session := sessions.Default(c)

	// Read pending OAuth data from session
	providerName, _ := session.Get("pending_oauth_provider").(string)
	providerUserID, _ := session.Get("pending_oauth_user_id").(string)
	if providerName == "" || providerUserID == "" {
		common.ApiErrorI18n(c, i18n.MsgOAuthPendingDataNotFound)
		return
	}

	provider := oauth.GetProvider(providerName)
	if provider == nil {
		common.ApiErrorI18n(c, i18n.MsgOAuthUnknownProvider)
		return
	}

	if !provider.IsEnabled() {
		common.ApiErrorI18n(c, i18n.MsgOAuthNotEnabled, providerParams(provider.GetName()))
		return
	}

	// Parse invitation code from request body
	var req struct {
		InvitationCode string `json:"invitation_code"`
	}
	if err := common.DecodeJson(c.Request.Body, &req); err != nil || req.InvitationCode == "" {
		common.ApiErrorI18n(c, i18n.MsgOAuthInvitationCodeRequired)
		return
	}
	req.InvitationCode = strings.TrimSpace(req.InvitationCode)

	// Validate invitation code
	if _, err := model.ValidateInvitationCode(req.InvitationCode); err != nil {
		common.ApiErrorI18n(c, i18n.MsgOAuthInvitationCodeInvalid)
		return
	}

	// Check that this OAuth ID is still not registered (race condition check)
	if provider.IsUserIDTaken(providerUserID) {
		// User was already registered (maybe in another tab), just clean up and tell frontend to retry login
		clearPendingOAuthSession(session)
		c.JSON(http.StatusOK, gin.H{
			"success": false,
			"message": "User already registered, please sign in again",
		})
		return
	}

	// Read remaining OAuth data from session
	oauthUsername, _ := session.Get("pending_oauth_username").(string)
	oauthDisplayName, _ := session.Get("pending_oauth_display_name").(string)
	oauthEmail, _ := session.Get("pending_oauth_email").(string)

	// Build user object
	user := &model.User{}
	user.Username = provider.GetProviderPrefix() + strconv.Itoa(model.GetMaxUserId()+1)
	if oauthUsername != "" {
		if exists, err := model.CheckUserExistOrDeleted(oauthUsername, ""); err == nil && !exists {
			if len(oauthUsername) <= model.UserNameMaxLength {
				user.Username = oauthUsername
			}
		}
	}
	if oauthDisplayName != "" {
		user.DisplayName = oauthDisplayName
	} else if oauthUsername != "" {
		user.DisplayName = oauthUsername
	} else {
		user.DisplayName = provider.GetName() + " User"
	}
	if oauthEmail != "" {
		user.Email = oauthEmail
	}
	user.Role = model.ResolveNewUserRole()
	user.Status = common.UserStatusEnabled

	// Handle affiliate code
	affCode := session.Get("aff")
	inviterId := 0
	if affCode != nil {
		inviterId, _ = model.GetUserIdByAffCode(affCode.(string))
	}

	// Create user + bind OAuth in transaction
	if genericProvider, ok := provider.(*oauth.GenericOAuthProvider); ok {
		err := model.DB.Transaction(func(tx *gorm.DB) error {
			if err := user.InsertWithTx(tx, inviterId); err != nil {
				return err
			}
			binding := &model.UserOAuthBinding{
				UserId:         user.Id,
				ProviderId:     genericProvider.GetProviderId(),
				ProviderUserId: providerUserID,
			}
			if err := model.CreateUserOAuthBindingWithTx(tx, binding); err != nil {
				return err
			}
			return model.UseInvitationCodeWithTx(tx, req.InvitationCode, user.Id)
		})
		if err != nil {
			if errors.Is(err, model.ErrInvitationCodeUnavailable) {
				common.ApiErrorI18n(c, i18n.MsgOAuthInvitationCodeInvalid)
				return
			}
			common.ApiError(c, err)
			return
		}
		user.FinalizeUserCreation(inviterId)
	} else {
		err := model.DB.Transaction(func(tx *gorm.DB) error {
			if err := user.InsertWithTx(tx, inviterId); err != nil {
				return err
			}
			provider.SetProviderUserID(user, providerUserID)
			if err := tx.Model(user).Updates(map[string]interface{}{
				"github_id":   user.GitHubId,
				"discord_id":  user.DiscordId,
				"oidc_id":     user.OidcId,
				"linux_do_id": user.LinuxDOId,
				"wechat_id":   user.WeChatId,
				"telegram_id": user.TelegramId,
			}).Error; err != nil {
				return err
			}
			return model.UseInvitationCodeWithTx(tx, req.InvitationCode, user.Id)
		})
		if err != nil {
			if errors.Is(err, model.ErrInvitationCodeUnavailable) {
				common.ApiErrorI18n(c, i18n.MsgOAuthInvitationCodeInvalid)
				return
			}
			common.ApiError(c, err)
			return
		}
		user.FinalizeUserCreation(inviterId)
	}

	// Clean up pending OAuth data from session
	clearPendingOAuthSession(session)

	// Setup login session
	setupLogin(user, c)
}

// clearPendingOAuthSession removes all pending OAuth registration data from session
func clearPendingOAuthSession(session sessions.Session) {
	session.Delete("pending_oauth_provider")
	session.Delete("pending_oauth_user_id")
	session.Delete("pending_oauth_username")
	session.Delete("pending_oauth_display_name")
	session.Delete("pending_oauth_email")
	session.Delete("invitation_code")
	session.Save()
}

// handleOAuthBind handles binding OAuth account to existing user
func handleOAuthBind(c *gin.Context, provider oauth.Provider) {
	if !provider.IsEnabled() {
		common.ApiErrorI18n(c, i18n.MsgOAuthNotEnabled, providerParams(provider.GetName()))
		return
	}

	// Exchange code for token
	code := c.Query("code")
	token, err := provider.ExchangeToken(c.Request.Context(), code, c)
	if err != nil {
		handleOAuthError(c, err)
		return
	}

	// Get user info
	oauthUser, err := provider.GetUserInfo(c.Request.Context(), token)
	if err != nil {
		handleOAuthError(c, err)
		return
	}

	// Check if this OAuth account is already bound (check both new ID and legacy ID)
	if provider.IsUserIDTaken(oauthUser.ProviderUserID) {
		common.ApiErrorI18n(c, i18n.MsgOAuthAlreadyBound, providerParams(provider.GetName()))
		return
	}
	// Also check legacy ID to prevent duplicate bindings during migration period
	if legacyID, ok := oauthUser.Extra["legacy_id"].(string); ok && legacyID != "" {
		if provider.IsUserIDTaken(legacyID) {
			common.ApiErrorI18n(c, i18n.MsgOAuthAlreadyBound, providerParams(provider.GetName()))
			return
		}
	}

	// Get current user from session
	session := sessions.Default(c)
	id := session.Get("id")
	user := model.User{Id: id.(int)}
	err = user.FillUserById()
	if err != nil {
		common.ApiError(c, err)
		return
	}

	// Handle binding based on provider type
	if genericProvider, ok := provider.(*oauth.GenericOAuthProvider); ok {
		// Custom provider: use user_oauth_bindings table
		err = model.UpdateUserOAuthBinding(user.Id, genericProvider.GetProviderId(), oauthUser.ProviderUserID)
		if err != nil {
			common.ApiError(c, err)
			return
		}
	} else {
		// Built-in provider: update user record directly
		provider.SetProviderUserID(&user, oauthUser.ProviderUserID)
		err = user.Update(false)
		if err != nil {
			common.ApiError(c, err)
			return
		}
	}

	common.ApiSuccessI18n(c, i18n.MsgOAuthBindSuccess, gin.H{
		"action": "bind",
	})
}

// findOrCreateOAuthUser finds existing user or creates new user
func findOrCreateOAuthUser(c *gin.Context, provider oauth.Provider, oauthUser *oauth.OAuthUser, session sessions.Session) (*model.User, error) {
	user := &model.User{}

	// Check if user already exists with new ID
	if provider.IsUserIDTaken(oauthUser.ProviderUserID) {
		err := provider.FillUserByProviderID(user, oauthUser.ProviderUserID)
		if err != nil {
			return nil, err
		}
		// Check if user has been deleted
		if user.Id == 0 {
			return nil, &OAuthUserDeletedError{}
		}
		return user, nil
	}

	// Try to find user with legacy ID (for GitHub migration from login to numeric ID)
	if legacyID, ok := oauthUser.Extra["legacy_id"].(string); ok && legacyID != "" {
		if provider.IsUserIDTaken(legacyID) {
			err := provider.FillUserByProviderID(user, legacyID)
			if err != nil {
				return nil, err
			}
			if user.Id != 0 {
				// Found user with legacy ID, migrate to new ID
				common.SysLog(fmt.Sprintf("[OAuth] Migrating user %d from legacy_id=%s to new_id=%s",
					user.Id, legacyID, oauthUser.ProviderUserID))
				if err := user.UpdateGitHubId(oauthUser.ProviderUserID); err != nil {
					common.SysError(fmt.Sprintf("[OAuth] Failed to migrate user %d: %s", user.Id, err.Error()))
					// Continue with login even if migration fails
				}
				return user, nil
			}
		}
	}

	// User doesn't exist, create new user if registration is enabled
	if !common.RegisterEnabled {
		return nil, &OAuthRegistrationDisabledError{}
	}
	invitationCode := ""
	// Invitation codes are enforced for password registration; OAuth auto-creation must also obey.
	if common.InvitationCodeEnabled {
		invitationCode, _ = session.Get("invitation_code").(string)
		invitationCode = strings.TrimSpace(invitationCode)
		if invitationCode == "" {
			return nil, &OAuthInvitationCodeRequiredError{}
		}
		_, err := model.ValidateInvitationCode(invitationCode)
		if err != nil {
			return nil, &OAuthInvitationCodeInvalidError{}
		}
	}

	// Set up new user
	user.Username = provider.GetProviderPrefix() + strconv.Itoa(model.GetMaxUserId()+1)

	if oauthUser.Username != "" {
		if exists, err := model.CheckUserExistOrDeleted(oauthUser.Username, ""); err == nil && !exists {
			// 防止索引退化
			if len(oauthUser.Username) <= model.UserNameMaxLength {
				user.Username = oauthUser.Username
			}
		}
	}

	if oauthUser.DisplayName != "" {
		user.DisplayName = oauthUser.DisplayName
	} else if oauthUser.Username != "" {
		user.DisplayName = oauthUser.Username
	} else {
		user.DisplayName = provider.GetName() + " User"
	}
	if oauthUser.Email != "" {
		user.Email = oauthUser.Email
	}
	user.Role = model.ResolveNewUserRole()
	user.Status = common.UserStatusEnabled

	// Handle affiliate code
	affCode := session.Get("aff")
	inviterId := 0
	if affCode != nil {
		inviterId, _ = model.GetUserIdByAffCode(affCode.(string))
	}

	// Use transaction to ensure user creation and OAuth binding are atomic
	if genericProvider, ok := provider.(*oauth.GenericOAuthProvider); ok {
		// Custom provider: create user and binding in a transaction
		err := model.DB.Transaction(func(tx *gorm.DB) error {
			// Create user
			if err := user.InsertWithTx(tx, inviterId); err != nil {
				return err
			}

			// Create OAuth binding
			binding := &model.UserOAuthBinding{
				UserId:         user.Id,
				ProviderId:     genericProvider.GetProviderId(),
				ProviderUserId: oauthUser.ProviderUserID,
			}
			if err := model.CreateUserOAuthBindingWithTx(tx, binding); err != nil {
				return err
			}
			if common.InvitationCodeEnabled {
				return model.UseInvitationCodeWithTx(tx, invitationCode, user.Id)
			}
			return nil
		})
		if err != nil {
			if errors.Is(err, model.ErrInvitationCodeUnavailable) {
				return nil, &OAuthInvitationCodeInvalidError{}
			}
			return nil, err
		}

		// Perform post-transaction tasks (logs, sidebar config, inviter rewards)
		user.FinalizeUserCreation(inviterId)
	} else {
		// Built-in provider: create user and update provider ID in a transaction
		err := model.DB.Transaction(func(tx *gorm.DB) error {
			// Create user
			if err := user.InsertWithTx(tx, inviterId); err != nil {
				return err
			}

			// Set the provider user ID on the user model and update
			provider.SetProviderUserID(user, oauthUser.ProviderUserID)
			if err := tx.Model(user).Updates(map[string]interface{}{
				"github_id":   user.GitHubId,
				"discord_id":  user.DiscordId,
				"oidc_id":     user.OidcId,
				"linux_do_id": user.LinuxDOId,
				"wechat_id":   user.WeChatId,
				"telegram_id": user.TelegramId,
			}).Error; err != nil {
				return err
			}
			if common.InvitationCodeEnabled {
				return model.UseInvitationCodeWithTx(tx, invitationCode, user.Id)
			}
			return nil
		})
		if err != nil {
			if errors.Is(err, model.ErrInvitationCodeUnavailable) {
				return nil, &OAuthInvitationCodeInvalidError{}
			}
			return nil, err
		}

		// Perform post-transaction tasks
		user.FinalizeUserCreation(inviterId)
	}

	if common.InvitationCodeEnabled {
		session.Delete("invitation_code")
		if err := session.Save(); err != nil {
			common.SysError(fmt.Sprintf("[OAuth] Failed to clear invitation code session: %s", err.Error()))
		}
	}

	return user, nil
}

// Error types for OAuth
type OAuthUserDeletedError struct{}

func (e *OAuthUserDeletedError) Error() string {
	return "user has been deleted"
}

type OAuthRegistrationDisabledError struct{}

func (e *OAuthRegistrationDisabledError) Error() string {
	return "registration is disabled"
}

type OAuthInvitationCodeRequiredError struct{}

func (e *OAuthInvitationCodeRequiredError) Error() string {
	return "invitation code required"
}

type OAuthInvitationCodeInvalidError struct{}

func (e *OAuthInvitationCodeInvalidError) Error() string {
	return "invalid invitation code"
}

// handleOAuthError handles OAuth errors and returns translated message
func handleOAuthError(c *gin.Context, err error) {
	switch e := err.(type) {
	case *oauth.OAuthError:
		if e.Params != nil {
			common.ApiErrorI18n(c, e.MsgKey, e.Params)
		} else {
			common.ApiErrorI18n(c, e.MsgKey)
		}
	case *oauth.AccessDeniedError:
		common.ApiErrorMsg(c, e.Message)
	case *oauth.TrustLevelError:
		common.ApiErrorI18n(c, i18n.MsgOAuthTrustLevelLow)
	default:
		common.ApiError(c, err)
	}
}
