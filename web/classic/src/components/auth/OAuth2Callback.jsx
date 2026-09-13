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

import React, { useContext, useEffect, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  API,
  showError,
  showSuccess,
  showInfo,
  updateAPI,
  applyLoginBundle,
  isLoginChallenge,
  isPendingRegistrationChallenge,
} from '../../helpers';
import { UserContext } from '../../context/User';
import Loading from '../common/ui/Loading';
import TwoFAVerification from './TwoFAVerification';
import { Modal, Input } from '@douyinfe/semi-ui';

const OAuth2Callback = (props) => {
  const { t } = useTranslation();
  const [searchParams] = useSearchParams();
  const [, userDispatch] = useContext(UserContext);
  const navigate = useNavigate();
  
  // 防止 React 18 Strict Mode 下重复执行
  const hasExecuted = useRef(false);

  // 注册码弹窗状态
  const [showRegistrationCodeModal, setShowRegistrationCodeModal] =
    useState(false);
  const [registrationCode, setRegistrationCode] = useState('');
  const [registrationCodeSubmitting, setRegistrationCodeSubmitting] =
    useState(false);
  const [registrationFlowToken, setRegistrationFlowToken] = useState('');

  // 二次验证状态
  const [showTwoFA, setShowTwoFA] = useState(false);
  const [loginFlowToken, setLoginFlowToken] = useState('');

  // 最大重试次数
  const MAX_RETRIES = 3;

  const applyBundleOrChallenge = (data) => {
    if (isLoginChallenge(data)) {
      setLoginFlowToken(data.flow_token);
      setShowTwoFA(true);
      return;
    }
    const loggedInUser = applyLoginBundle(data, userDispatch);
    if (!loggedInUser) {
      showError(t('登录失败，请重试'));
      return;
    }
    updateAPI();
    showSuccess(t('登录成功！'));
    navigate('/console/token');
  };

  const handleRegistrationCodeSubmit = async () => {
    if (!registrationCode.trim()) {
      showInfo(t('请输入注册码'));
      return;
    }
    setRegistrationCodeSubmitting(true);
    try {
      const res = await API.post('/api/user/register/complete', {
        flow_token: registrationFlowToken,
        registration_code: registrationCode.trim(),
      });
      const { success, message, data } = res.data;
      if (success) {
        setShowRegistrationCodeModal(false);
        if (
          data &&
          typeof data === 'object' &&
          (data.access_token || data.require_verification)
        ) {
          applyBundleOrChallenge(data);
          return;
        }
        showSuccess(t('注册成功！'));
        navigate('/login');
      } else {
        showError(message || t('注册码无效'));
      }
    } catch (error) {
      showError(t('注册失败，请重试'));
    } finally {
      setRegistrationCodeSubmitting(false);
    }
  };

  const handle2FASuccess = (data) => {
    const loggedInUser = applyLoginBundle(data, userDispatch);
    if (!loggedInUser) {
      showError(t('登录失败，请重试'));
      return;
    }
    updateAPI();
    showSuccess(t('登录成功！'));
    navigate('/console/token');
  };

  const sendCode = async (code, state, retry = 0) => {
    try {
      const { data: resData } = await API.get(
        `/api/oauth/${props.type}?code=${code}&state=${state}`,
      );

      const { success, message, data } = resData;

      if (!success) {
        // 业务错误不重试，直接显示错误
        showError(message || t('授权失败'));
        return;
      }

      if (data?.action === 'bind') {
        showSuccess(t('绑定成功！'));
        navigate('/console/personal');
        return;
      }

      if (isPendingRegistrationChallenge(data)) {
        setRegistrationFlowToken(data.flow_token);
        setShowRegistrationCodeModal(true);
        return;
      }

      applyBundleOrChallenge(data);
    } catch (error) {
      // 网络错误等可重试
      if (retry < MAX_RETRIES) {
        // 递增的退避等待
        await new Promise((resolve) => setTimeout(resolve, (retry + 1) * 2000));
        return sendCode(code, state, retry + 1);
      }

      // 重试次数耗尽，提示错误并返回设置页面
      showError(error.message || t('授权失败'));
      navigate('/console/personal');
    }
  };

  useEffect(() => {
    // 防止 React 18 Strict Mode 下重复执行
    if (hasExecuted.current) {
      return;
    }
    hasExecuted.current = true;

    const code = searchParams.get('code');
    const state = searchParams.get('state');

    // 参数缺失直接返回
    if (!code) {
      showError(t('未获取到授权码'));
      navigate('/console/personal');
      return;
    }

    sendCode(code, state);
  }, []);

  return (
    <>
      {showTwoFA ? (
        <TwoFAVerification
          flowToken={loginFlowToken}
          onSuccess={handle2FASuccess}
          onBack={() => {
            setShowTwoFA(false);
            navigate('/login');
          }}
        />
      ) : (
        <Loading />
      )}
      <Modal
        title={t('需要注册码')}
        visible={showRegistrationCodeModal}
        maskClosable={false}
        onOk={handleRegistrationCodeSubmit}
        onCancel={() => {
          setShowRegistrationCodeModal(false);
          showInfo(t('注册已取消，请登录'));
          navigate('/login');
        }}
        okText={t('确认')}
        cancelText={t('取消')}
        centered={true}
        okButtonProps={{
          loading: registrationCodeSubmitting,
          disabled: !registrationCode.trim(),
        }}
      >
        <p style={{ marginBottom: 16 }}>
          {t('注册需要注册码，请输入您的注册码以继续。')}
        </p>
        <Input
          placeholder={t('请输入注册码')}
          value={registrationCode}
          onChange={setRegistrationCode}
          autoFocus
        />
      </Modal>
    </>
  );
};

export default OAuth2Callback;
