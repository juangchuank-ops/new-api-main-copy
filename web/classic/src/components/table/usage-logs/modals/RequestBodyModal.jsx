import React, { useState, useEffect, useCallback } from 'react';
import {
  Modal,
  Spin,
  Typography,
  Empty,
  Tag,
  Space,
  Button,
  Descriptions,
} from '@douyinfe/semi-ui';
import { IconCopy } from '@douyinfe/semi-icons';
import { API, copy, showSuccess, showError } from '../../../../helpers';

const { Text, Paragraph } = Typography;

const formatBody = (body, encoding, contentType) => {
  if (!body) {
    return null;
  }
  if (encoding === 'base64') {
    return body;
  }
  // Try to parse and pretty-print JSON
  if (
    contentType &&
    (contentType.includes('json') || contentType.includes('javascript'))
  ) {
    try {
      return JSON.stringify(JSON.parse(body), null, 2);
    } catch {
      return body;
    }
  }
  return body;
};

const RequestBodyModal = ({
  showRequestBodyModal,
  setShowRequestBodyModal,
  requestBodyTarget,
}) => {
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);

  const fetchData = useCallback(async (requestId) => {
    if (!requestId) {
      return;
    }
    setLoading(true);
    setError(null);
    setData(null);
    try {
      const res = await API.get(`/api/log/${requestId}/request-body`);
      if (res.data?.success) {
        setData(res.data.data);
      } else {
        setError(res.data?.message || 'Failed to load request body');
      }
    } catch (err) {
      setError(err.response?.data?.message || err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (showRequestBodyModal && requestBodyTarget) {
      fetchData(requestBodyTarget);
    }
    // Reset on close
    if (!showRequestBodyModal) {
      setData(null);
      setError(null);
    }
  }, [showRequestBodyModal, requestBodyTarget, fetchData]);

  const handleCopy = () => {
    if (data?.body) {
      const formatted = formatBody(
        data.body,
        data.body_encoding,
        data.content_type,
      );
      if (formatted) {
        copy(formatted).then(() => showSuccess('Copied'));
      }
    }
  };

  const formattedBody = data
    ? formatBody(data.body, data.body_encoding, data.content_type)
    : null;

  return (
    <Modal
      title='Request Body'
      visible={showRequestBodyModal}
      onCancel={() => setShowRequestBodyModal(false)}
      footer={null}
      width={800}
      style={{ top: 20 }}
    >
      {loading && (
        <div style={{ textAlign: 'center', padding: '40px 0' }}>
          <Spin size='large' />
        </div>
      )}

      {!loading && error && (
        <Empty
          description={error}
          style={{ padding: 40 }}
        />
      )}

      {!loading && !error && data && (
        <Space vertical align='start' style={{ width: '100%' }} spacing={16}>
          <Descriptions
            row
            size='small'
            style={{ width: '100%' }}
            data={[
              {
                key: 'Content-Type',
                value: data.content_type || '-',
              },
              {
                key: 'Body Bytes',
                value: data.body_bytes ?? '-',
              },
              {
                key: 'Stored Bytes',
                value: data.stored_bytes ?? '-',
              },
              {
                key: 'Compression',
                value: data.compression || '-',
              },
              {
                key: 'Truncated',
                value: data.body_truncated ? (
                  <Tag color='orange' size='small'>
                    Yes
                  </Tag>
                ) : (
                  <Tag color='green' size='small'>
                    No
                  </Tag>
                ),
              },
              {
                key: 'Encoding',
                value: data.body_encoding || 'text',
              },
            ]}
          />

          <div
            style={{
              width: '100%',
              display: 'flex',
              justifyContent: 'flex-end',
            }}
          >
            <Button
              icon={<IconCopy />}
              size='small'
              onClick={handleCopy}
              disabled={!formattedBody}
            >
              Copy
            </Button>
          </div>

          <div
            style={{
              width: '100%',
              maxHeight: '60vh',
              overflow: 'auto',
              background: 'var(--semi-color-fill-0)',
              borderRadius: 6,
              padding: 12,
            }}
          >
            {formattedBody ? (
              <Paragraph
                style={{
                  margin: 0,
                  whiteSpace: 'pre-wrap',
                  wordBreak: 'break-all',
                  fontFamily:
                    'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
                  fontSize: 13,
                  lineHeight: 1.5,
                }}
              >
                {formattedBody}
              </Paragraph>
            ) : (
              <Empty description='No body data' style={{ padding: 20 }} />
            )}
          </div>
        </Space>
      )}

      {!loading && !error && !data && (
        <Empty description='No data' style={{ padding: 40 }} />
      )}
    </Modal>
  );
};

export default RequestBodyModal;
