import React, { useState, useEffect } from "react";
import { Card, CardBody } from "@heroui/card";
import { Button } from "@heroui/button";
import {
  Modal,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  useDisclosure,
} from "@heroui/modal";
import { Input } from "@heroui/input";
import { toast } from "react-hot-toast";
import { useNavigate } from "react-router-dom";
import {
  ArrowRightStartOnRectangleIcon,
  ClockIcon,
  Cog6ToothIcon,
  KeyIcon,
  UserIcon,
  UsersIcon,
} from "@heroicons/react/24/outline";

import { isWebViewFunc } from "@/utils/panel";
import { siteConfig } from "@/config/site";
import { withDesignPreview } from "@/config/design-preview";
import { updatePassword } from "@/api";
import { safeLogout } from "@/utils/logout";
interface PasswordForm {
  newUsername: string;
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
}

interface MenuItem {
  path: string;
  label: string;
  icon: React.ReactNode;
  color: string;
  description: string;
}

export default function ProfilePage() {
  const navigate = useNavigate();
  const { isOpen, onOpen, onOpenChange } = useDisclosure();
  const [username, setUsername] = useState("");
  const [isAdmin, setIsAdmin] = useState(false);
  const [passwordLoading, setPasswordLoading] = useState(false);
  const [passwordForm, setPasswordForm] = useState<PasswordForm>({
    newUsername: "",
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  });

  useEffect(() => {
    // 获取用户信息
    const name = localStorage.getItem("name") || "Admin";

    // 兼容处理：如果没有admin字段，根据role_id判断（0为管理员）
    let adminFlag = localStorage.getItem("admin") === "true";

    if (localStorage.getItem("admin") === null) {
      const roleId = parseInt(localStorage.getItem("role_id") || "1", 10);

      adminFlag = roleId === 0;
      // 补充设置admin字段，避免下次再次判断
      localStorage.setItem("admin", adminFlag.toString());
    }

    setUsername(name);
    setIsAdmin(adminFlag);
  }, []);

  // 管理员菜单项
  const adminMenuItems: MenuItem[] = [
    {
      path: "/limit",
      label: "限速管理",
      icon: <ClockIcon className="w-5 h-5" />,
      color:
        "bg-amber-50 text-amber-700",
      description: "管理用户限速策略",
    },
    {
      path: "/user",
      label: "用户管理",
      icon: <UsersIcon className="w-5 h-5" />,
      color: "bg-blue-50 text-blue-600",
      description: "管理系统用户",
    },
    {
      path: "/config",
      label: "网站配置",
      icon: <Cog6ToothIcon className="w-5 h-5" />,
      color:
        "bg-violet-50 text-violet-600",
      description: "配置网站设置",
    },
  ];

  // 退出登录
  const handleLogout = () => {
    safeLogout();
    navigate("/", { replace: true });
  };

  // 密码表单验证
  const validatePasswordForm = (): boolean => {
    if (!passwordForm.newUsername.trim()) {
      toast.error("请输入新用户名");

      return false;
    }
    if (passwordForm.newUsername.length < 3) {
      toast.error("用户名长度至少3位");

      return false;
    }
    if (!passwordForm.currentPassword) {
      toast.error("请输入当前密码");

      return false;
    }
    if (!passwordForm.newPassword) {
      toast.error("请输入新密码");

      return false;
    }
    if (passwordForm.newPassword.length < 6) {
      toast.error("新密码长度不能少于6位");

      return false;
    }
    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      toast.error("两次输入密码不一致");

      return false;
    }

    return true;
  };

  // 提交密码修改
  const handlePasswordSubmit = async () => {
    if (!validatePasswordForm()) return;

    setPasswordLoading(true);
    try {
      const response = await updatePassword(passwordForm);

      if (response.code === 0) {
        toast.success("密码修改成功，请重新登录");
        onOpenChange();
        handleLogout();
      } else {
        toast.error(response.msg || "密码修改失败");
      }
    } catch (error) {
      toast.error("修改密码时发生错误");
      console.error("修改密码错误:", error);
    } finally {
      setPasswordLoading(false);
    }
  };

  // 重置密码表单
  const resetPasswordForm = () => {
    setPasswordForm({
      newUsername: "",
      currentPassword: "",
      newPassword: "",
      confirmPassword: "",
    });
  };

  return (
    <div className="page-shell flex flex-col">
      <div className="space-y-6 flex-1">
        <div>
          <h1 className="page-title">个人中心</h1>
          <p className="page-subtitle">
            查看当前账号并访问常用管理入口
          </p>
        </div>
        {/* 用户信息卡片 */}
        <Card className="rounded-xl border border-zinc-200 bg-white shadow-sm">
          <CardBody className="p-4">
            <div className="flex items-center space-x-4">
              <div className="flex h-11 w-11 items-center justify-center rounded-full bg-blue-50">
                <UserIcon className="w-6 h-6 text-primary" />
              </div>
              <div className="flex-1">
                <h3 className="text-base font-medium text-foreground">
                  {username}
                </h3>
                <div className="flex items-center space-x-2 mt-1">
                  <span
                    className={`px-2 py-1 rounded-md text-xs font-medium ${
                      isAdmin
                        ? "bg-blue-50 text-blue-700"
                        : "bg-zinc-100 text-zinc-700"
                    }`}
                  >
                    {isAdmin ? "管理员" : "普通用户"}
                  </span>
                  <span className="text-xs text-default-500">
                    {new Date().toLocaleDateString("zh-CN")}
                  </span>
                </div>
              </div>
            </div>
          </CardBody>
        </Card>

        {/* 功能网格 */}
        <Card className="rounded-xl border border-zinc-200 bg-white shadow-sm">
          <CardBody className="p-4">
            <div className="grid grid-cols-3 gap-3">
              {/* 管理员功能 */}
              {isAdmin &&
                adminMenuItems.map((item) => (
                  <button
                    key={item.path}
                    className="flex flex-col items-center rounded-xl bg-zinc-50 p-3 transition-colors duration-150 hover:bg-zinc-100"
                    onClick={() => navigate(withDesignPreview(item.path))}
                  >
                    <div
                      className={`w-10 h-10 ${item.color} rounded-full flex items-center justify-center mb-2`}
                    >
                      {item.icon}
                    </div>
                    <span className="text-xs text-foreground text-center">
                      {item.label}
                    </span>
                  </button>
                ))}

              {/* 修改密码 */}
              <button
                className="flex flex-col items-center rounded-xl bg-zinc-50 p-3 transition-colors duration-150 hover:bg-zinc-100"
                onClick={onOpen}
              >
                <div className="mb-2 flex h-9 w-9 items-center justify-center rounded-full bg-blue-50 text-blue-600">
                  <KeyIcon className="w-5 h-5" />
                </div>
                <span className="text-xs text-foreground text-center">
                  修改密码
                </span>
              </button>

              {/* 退出登录 */}
              <button
                className="flex flex-col items-center rounded-xl bg-zinc-50 p-3 transition-colors duration-150 hover:bg-zinc-100"
                onClick={handleLogout}
              >
                <div className="mb-2 flex h-9 w-9 items-center justify-center rounded-full bg-red-50 text-red-600">
                  <ArrowRightStartOnRectangleIcon className="w-5 h-5" />
                </div>
                <span className="text-xs text-foreground text-center">
                  退出登录
                </span>
              </button>
            </div>
          </CardBody>
        </Card>

        <div className="fixed inset-x-0 bottom-20 text-center py-4">
          <p className="text-[11px] text-zinc-400">
            Powered by{" "}
            <span className="text-gray-500">TMS</span>
          </p>
          <p className="mt-1 text-[11px] text-zinc-400">
            v{isWebViewFunc() ? siteConfig.app_version : siteConfig.version}
          </p>
        </div>
      </div>

      {/* 修改密码弹窗 */}
      <Modal
        backdrop="opaque"
        isOpen={isOpen}
        placement="center"
        scrollBehavior="outside"
        size="2xl"
        onOpenChange={() => {
          onOpenChange();
          resetPasswordForm();
        }}
      >
        <ModalContent>
          {(onClose: () => void) => (
            <>
              <ModalHeader className="flex flex-col gap-1">
                修改密码
              </ModalHeader>
              <ModalBody>
                <div className="space-y-4">
                  <Input
                    label="新用户名"
                    placeholder="请输入新用户名（至少3位）"
                    value={passwordForm.newUsername}
                    variant="bordered"
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                      setPasswordForm((prev) => ({
                        ...prev,
                        newUsername: e.target.value,
                      }))
                    }
                  />
                  <Input
                    label="当前密码"
                    placeholder="请输入当前密码"
                    type="password"
                    value={passwordForm.currentPassword}
                    variant="bordered"
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                      setPasswordForm((prev) => ({
                        ...prev,
                        currentPassword: e.target.value,
                      }))
                    }
                  />
                  <Input
                    label="新密码"
                    placeholder="请输入新密码（至少6位）"
                    type="password"
                    value={passwordForm.newPassword}
                    variant="bordered"
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                      setPasswordForm((prev) => ({
                        ...prev,
                        newPassword: e.target.value,
                      }))
                    }
                  />
                  <Input
                    label="确认密码"
                    placeholder="请再次输入新密码"
                    type="password"
                    value={passwordForm.confirmPassword}
                    variant="bordered"
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                      setPasswordForm((prev) => ({
                        ...prev,
                        confirmPassword: e.target.value,
                      }))
                    }
                  />
                </div>
              </ModalBody>
              <ModalFooter>
                <Button color="default" variant="light" onPress={onClose}>
                  取消
                </Button>
                <Button
                  color="primary"
                  isLoading={passwordLoading}
                  onPress={handlePasswordSubmit}
                >
                  确定
                </Button>
              </ModalFooter>
            </>
          )}
        </ModalContent>
      </Modal>
    </div>
  );
}
