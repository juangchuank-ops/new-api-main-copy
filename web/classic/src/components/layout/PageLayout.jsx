/*
Copyright (C) 2025 QuantumNous

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as
published by the Free Software Foundation, either version 3 of the
License, or (at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
GNU Affero General Public License for more details.

You should have received a copy of the GNU Affero General Public License
along with this program. If not, see <https://www.gnu.org/licenses/>.

For commercial licensing, please contact support@quantumnous.com
*/

import HeaderBar from './headerbar';
import { Button, Layout } from '@douyinfe/semi-ui';
import { PanelLeft } from 'lucide-react';
import SiderBar from './SiderBar';
import App from '../../App';
import FooterBar from './Footer';
import { ToastContainer } from 'react-toastify';
import ErrorBoundary from '../common/ErrorBoundary';
import PublicBanners from '../banner/PublicBanners';
import React, { useContext, useEffect, useRef, useState } from 'react';
import { useIsMobile } from '../../hooks/common/useIsMobile';
import { useSidebarCollapsed } from '../../hooks/common/useSidebarCollapsed';
import { useAppearance, useSetAppearance } from '../../context/ThemeAppearance';
import { useTranslation } from 'react-i18next';
import {
  API,
  getLogo,
  getSystemName,
  showError,
  setStatusData,
} from '../../helpers';
import { UserContext } from '../../context/User';
import { StatusContext } from '../../context/Status';
import { useLocation } from 'react-router-dom';
import { normalizeLanguage } from '../../i18n/language';
import { FloatingWindowHost } from '../floating-window';
const { Sider, Content, Header } = Layout;

const PageLayout = () => {
  const [userState, userDispatch] = useContext(UserContext);
  const [, statusDispatch] = useContext(StatusContext);
  const isMobile = useIsMobile();
  const [collapsed, , setCollapsed] = useSidebarCollapsed();
  const { sidebarVariant, layoutMode } = useAppearance();
  const setAppearance = useSetAppearance();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const { t, i18n } = useTranslation();
  const location = useLocation();

  const cardProPages = [
    '/console/channel',
    '/console/log',
    '/console/redemption',
    '/console/user',
    '/console/token',
    '/console/midjourney',
    '/console/task',
    '/console/models',
    '/pricing',
    '/model-health',
  ];

  const shouldHideFooter = cardProPages.includes(location.pathname);

  const shouldInnerPadding =
    location.pathname.includes('/console') &&
    !location.pathname.startsWith('/console/chat') &&
    location.pathname !== '/console/playground';

  const isConsoleRoute = location.pathname.startsWith('/console');
  const fullscreenLayout =
    isConsoleRoute && layoutMode === 'fullscreen' && !isMobile;
  const floatingSidebar = sidebarVariant === 'floating' && !isMobile;
  const insetLayout = sidebarVariant === 'inset' && !isMobile && isConsoleRoute;
  const showSider =
    isConsoleRoute && !fullscreenLayout && (!isMobile || drawerOpen);
  const isFixedLayout = isConsoleRoute || location.pathname === '/pricing';
  const contentMarginLeft =
    !isMobile && showSider && !floatingSidebar
      ? 'var(--sidebar-current-width)'
      : '0';

  useEffect(() => {
    if (isMobile && drawerOpen && collapsed) {
      setCollapsed(false);
    }
  }, [isMobile, drawerOpen, collapsed, setCollapsed]);

  // 布局模式切换时同步折叠状态（跳过首次挂载，避免覆盖已保存的折叠偏好）
  const layoutModeRef = useRef(layoutMode);
  useEffect(() => {
    if (layoutModeRef.current === layoutMode) return;
    layoutModeRef.current = layoutMode;
    if (layoutMode === 'default') {
      setCollapsed(false);
    } else if (layoutMode === 'compact') {
      setCollapsed(true);
    }
  }, [layoutMode, setCollapsed]);

  const loadUser = () => {
    let user = localStorage.getItem('user');
    if (user) {
      let data = JSON.parse(user);
      userDispatch({ type: 'login', payload: data });
    }
  };

  const loadStatus = async () => {
    try {
      const res = await API.get('/api/status');
      const { success, data } = res.data;
      if (success) {
        statusDispatch({ type: 'set', payload: data });
        setStatusData(data);
      } else {
        showError('Unable to connect to server');
      }
    } catch (error) {
      showError('Failed to load status');
    }
  };

  useEffect(() => {
    loadUser();
    loadStatus().catch(console.error);
    let systemName = getSystemName();
    if (systemName) {
      document.title = systemName;
    }
    let logo = getLogo();
    if (logo) {
      let linkElement = document.querySelector("link[rel~='icon']");
      if (linkElement) {
        linkElement.href = logo;
      }
    }
  }, []);

  useEffect(() => {
    let preferredLang;

    if (userState?.user?.setting) {
      try {
        const settings = JSON.parse(userState.user.setting);
        preferredLang = normalizeLanguage(settings.language);
      } catch (e) {
        // Ignore parse errors
      }
    }

    if (!preferredLang) {
      const savedLang = localStorage.getItem('i18nextLng');
      if (savedLang) {
        preferredLang = normalizeLanguage(savedLang);
      }
    }

    if (preferredLang) {
      localStorage.setItem('i18nextLng', preferredLang);
      if (preferredLang !== i18n.language) {
        i18n.changeLanguage(preferredLang);
      }
    }
  }, [i18n, userState?.user?.setting]);

  return (
    <Layout
      className={`app-layout${isFixedLayout ? ' app-layout-fixed' : ''}`}
      style={{
        display: 'flex',
        flexDirection: 'column',
        overflow: isFixedLayout && !isMobile ? 'hidden' : 'visible',
      }}
    >
      <Header
        style={{
          padding: 0,
          height: 'auto',
          lineHeight: 'normal',
          position: 'fixed',
          width: '100%',
          top: 0,
          zIndex: 100,
        }}
      >
        <HeaderBar
          onMobileMenuToggle={() => setDrawerOpen((prev) => !prev)}
          drawerOpen={drawerOpen}
        />
      </Header>
      <PublicBanners
        style={{
          marginTop: '64px',
          marginLeft: contentMarginLeft,
          width:
            contentMarginLeft === '0'
              ? '100%'
              : 'calc(100% - var(--sidebar-current-width))',
        }}
      />
      <Layout
        style={{
          overflow: isFixedLayout && !isMobile ? 'auto' : 'visible',
          display: 'flex',
          flexDirection: 'column',
          flex: '1 1 auto',
        }}
      >
        {showSider && (
          <Sider
            className='app-sider'
            style={
              floatingSidebar
                ? {
                    position: 'fixed',
                    left: '8px',
                    top: '72px',
                    bottom: '8px',
                    height: 'auto',
                    zIndex: 99,
                    border: 'none',
                    width: 'var(--sidebar-current-width)',
                    borderRadius: '12px',
                    overflow: 'hidden',
                    boxShadow: 'var(--shadow-lg)',
                    background: 'var(--semi-color-bg-1)',
                  }
                : {
                    position: 'fixed',
                    left: 0,
                    top: '64px',
                    zIndex: 99,
                    border: 'none',
                    paddingRight: '0',
                    width: 'var(--sidebar-current-width)',
                  }
            }
          >
            <SiderBar
              onNavigate={() => {
                if (isMobile) setDrawerOpen(false);
              }}
            />
          </Sider>
        )}
        <Layout
          style={{
            marginLeft: insetLayout
              ? 'calc(var(--sidebar-current-width) + 8px)'
              : contentMarginLeft,
            marginTop: insetLayout ? '8px' : 0,
            marginRight: insetLayout ? '8px' : 0,
            flex: '1 1 auto',
            display: 'flex',
            flexDirection: 'column',
            minHeight: 0,
            ...(insetLayout
              ? {
                  borderRadius: '12px',
                  border: '1px solid var(--semi-color-border)',
                  background: 'var(--semi-color-bg-1)',
                }
              : {}),
          }}
        >
          <Content
            className={isFixedLayout ? undefined : 'public-page-content'}
            style={{
              flex: isFixedLayout ? '1 0 auto' : '1 1 auto',
              overflowY: isFixedLayout && !isMobile ? 'hidden' : 'visible',
              WebkitOverflowScrolling: 'touch',
              padding: shouldInnerPadding ? (isMobile ? '5px' : '24px') : '0',
              position: 'relative',
              minHeight: 0,
            }}
          >
            <ErrorBoundary>
              <App />
            </ErrorBoundary>
          </Content>
          {!shouldHideFooter && (
            <Layout.Footer
              style={{
                flex: '0 0 auto',
                width: '100%',
              }}
            >
              <FooterBar />
            </Layout.Footer>
          )}
        </Layout>
      </Layout>
      {!isMobile && <FloatingWindowHost />}
      {fullscreenLayout && (
        <Button
          aria-label={t('恢复侧边栏')}
          icon={<PanelLeft size={16} />}
          onClick={() => setAppearance('layoutMode', 'default')}
          style={{
            position: 'fixed',
            left: '16px',
            bottom: '16px',
            zIndex: 98,
            borderRadius: '9999px',
            boxShadow: 'var(--shadow-lg)',
          }}
        />
      )}
      <ToastContainer />
    </Layout>
  );
};

export default PageLayout;
