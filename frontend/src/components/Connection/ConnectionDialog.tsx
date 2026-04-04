import { useEffect, useState } from "react";
import {
  App as AntdApp,
  Alert,
  Button,
  Flex,
  Form,
  Input,
  InputNumber,
  Modal,
  Radio,
  Select,
  Space,
} from "antd";
import { ThunderboltOutlined } from "@ant-design/icons";
import { TestConnection } from "../../../wailsjs/go/main/App";
import { useConnectionStore } from "../../stores/connectionStore";
import type { ConnectionConfig } from "../../types";

const ROLE_OPTIONS = [
  { value: "", label: "Normal" },
  { value: "SYSDBA", label: "SYSDBA" },
  { value: "SYSOPER", label: "SYSOPER" },
];

export interface ConnectionDialogProps {
  open: boolean;
  /** `null` = new profile; otherwise edit existing (must include `id`). */
  initial: ConnectionConfig | null;
  onClose: () => void;
}

type TargetType = "service" | "sid";

type FormValues = {
  name: string;
  host: string;
  port: number;
  targetType: TargetType;
  serviceName: string;
  sid: string;
  username: string;
  password: string;
  role: string;
};

function formValuesToConfig(
  values: FormValues,
  initial: ConnectionConfig | null
): ConnectionConfig {
  const useSid = values.targetType === "sid";
  const password =
    values.password?.trim() !== ""
      ? values.password
      : (initial?.password ?? "");
  return {
    id: initial?.id ?? "",
    name: values.name.trim(),
    host: values.host.trim(),
    port: values.port,
    serviceName: useSid ? "" : values.serviceName.trim(),
    sid: useSid ? values.sid.trim() : "",
    username: values.username.trim(),
    password,
    role: values.role ?? "",
  };
}

export function ConnectionDialog({
  open,
  initial,
  onClose,
}: ConnectionDialogProps) {
  const { message } = AntdApp.useApp();
  const [form] = Form.useForm<FormValues>();
  const saveConnection = useConnectionStore((s) => s.saveConnection);
  const connect = useConnectionStore((s) => s.connect);

  const [testLoading, setTestLoading] = useState(false);
  const [saveLoading, setSaveLoading] = useState(false);
  const [connectLoading, setConnectLoading] = useState(false);
  const [testMessage, setTestMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  useEffect(() => {
    if (!open) {
      setTestMessage(null);
      return;
    }
    setTestMessage(null);
    if (initial) {
      form.setFieldsValue({
        name: initial.name,
        host: initial.host,
        port: initial.port || 1521,
        targetType: initial.sid ? "sid" : "service",
        serviceName: initial.serviceName ?? "",
        sid: initial.sid ?? "",
        username: initial.username,
        password: initial.password ?? "",
        role: initial.role ?? "",
      });
    } else {
      form.resetFields();
      form.setFieldsValue({
        port: 1521,
        targetType: "service",
        role: "",
        serviceName: "",
        sid: "",
        password: "",
      });
    }
  }, [open, initial, form]);

  const handleTest = async () => {
    setTestMessage(null);
    try {
      const values = await form.validateFields();
      setTestLoading(true);
      const cfg = formValuesToConfig(values, initial);
      const banner = await TestConnection(cfg);
      setTestMessage({ type: "success", text: banner });
      message.success("Connection OK");
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setTestMessage({ type: "error", text: msg });
      message.error("Test failed");
    } finally {
      setTestLoading(false);
    }
  };

  const handleSave = async () => {
    setTestMessage(null);
    try {
      const values = await form.validateFields();
      setSaveLoading(true);
      await saveConnection(formValuesToConfig(values, initial));
      message.success("Connection saved");
      onClose();
    } catch (e) {
      if (e && typeof e === "object" && "errorFields" in e) {
        return;
      }
      message.error("Could not save");
    } finally {
      setSaveLoading(false);
    }
  };

  const handleConnect = async () => {
    setTestMessage(null);
    try {
      const values = await form.validateFields();
      setConnectLoading(true);
      const cfg = formValuesToConfig(values, initial);
      const saved = await saveConnection(cfg);
      await connect(saved.id);
      message.success("Connected");
      onClose();
    } catch (e) {
      if (e && typeof e === "object" && "errorFields" in e) {
        return;
      }
      message.error("Could not connect");
    } finally {
      setConnectLoading(false);
    }
  };

  const title = initial ? "Edit connection" : "New connection";

  return (
    <Modal
      title={title}
      open={open}
      onCancel={onClose}
      destroyOnClose
      width={520}
      footer={null}
    >
      <Form form={form} layout="vertical" requiredMark="optional" size="middle">
        <Form.Item
          name="name"
          label="Connection name"
          rules={[{ required: true, message: "Name is required" }]}
        >
          <Input autoComplete="off" placeholder="My database" />
        </Form.Item>
        <Flex gap={12}>
          <Form.Item
            name="host"
            label="Host"
            rules={[{ required: true, message: "Host is required" }]}
            style={{ flex: 1 }}
          >
            <Input autoComplete="off" placeholder="localhost" />
          </Form.Item>
          <Form.Item
            name="port"
            label="Port"
            rules={[
              { required: true, message: "Port is required" },
              {
                type: "number",
                min: 1,
                max: 65535,
                message: "Port must be 1–65535",
              },
            ]}
            style={{ width: 120 }}
          >
            <InputNumber style={{ width: "100%" }} controls={false} />
          </Form.Item>
        </Flex>

        <Form.Item label="Database" required>
          <Form.Item name="targetType" noStyle initialValue="service">
            <Radio.Group optionType="button" buttonStyle="solid">
              <Radio.Button value="service">Service name</Radio.Button>
              <Radio.Button value="sid">SID</Radio.Button>
            </Radio.Group>
          </Form.Item>
          <Form.Item
            noStyle
            shouldUpdate={(prev, cur) => prev.targetType !== cur.targetType}
          >
            {({ getFieldValue }) =>
              getFieldValue("targetType") === "service" ? (
                <Form.Item
                  name="serviceName"
                  style={{ marginBottom: 0, marginTop: 12 }}
                  rules={[
                    {
                      required: true,
                      message: "Service name is required",
                    },
                  ]}
                >
                  <Input autoComplete="off" placeholder="ORCLPDB1" />
                </Form.Item>
              ) : (
                <Form.Item
                  name="sid"
                  style={{ marginBottom: 0, marginTop: 12 }}
                  rules={[{ required: true, message: "SID is required" }]}
                >
                  <Input autoComplete="off" placeholder="ORCL" />
                </Form.Item>
              )
            }
          </Form.Item>
        </Form.Item>

        <Form.Item
          name="username"
          label="Username"
          rules={[{ required: true, message: "Username is required" }]}
        >
          <Input autoComplete="off" />
        </Form.Item>
        <Form.Item name="password" label="Password">
          <Input.Password autoComplete="new-password" placeholder="••••••••" />
        </Form.Item>
        <Form.Item name="role" label="Role" initialValue="">
          <Select options={ROLE_OPTIONS} />
        </Form.Item>

        {testMessage && (
          <Alert
            type={testMessage.type === "success" ? "success" : "error"}
            message={
              testMessage.type === "success"
                ? "Oracle version / test result"
                : "Test failed"
            }
            description={testMessage.text}
            showIcon
            style={{ marginBottom: 16 }}
          />
        )}

        <Flex justify="space-between" align="center" wrap="wrap" gap={8}>
          <Button
            icon={<ThunderboltOutlined />}
            onClick={() => void handleTest()}
            loading={testLoading}
            disabled={saveLoading || connectLoading}
          >
            Test connection
          </Button>
          <Space wrap>
            <Button onClick={onClose}>Cancel</Button>
            <Button
              onClick={() => void handleSave()}
              loading={saveLoading}
              disabled={connectLoading || testLoading}
            >
              Save
            </Button>
            <Button
              type="primary"
              onClick={() => void handleConnect()}
              loading={connectLoading}
              disabled={saveLoading || testLoading}
            >
              Connect
            </Button>
          </Space>
        </Flex>
      </Form>
    </Modal>
  );
}
