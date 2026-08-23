-- ============================================================
-- TMS 面板 · 转发协议链接/订阅
-- 加法式迁移:只新增可空列,不动已有转发和订阅数据。
-- 目标库:MySQL 5.7 / utf8mb4。
-- 注意:MySQL 5.7 不支持 ADD COLUMN IF NOT EXISTS,重复执行报 1060 时忽略即可。
-- ============================================================

ALTER TABLE `forward`
  ADD COLUMN `source_link` longtext
    COMMENT '原始客户端协议分享链接,仅用于生成转发客户端链接';

ALTER TABLE `user`
  ADD COLUMN `forward_sub_token` varchar(64) DEFAULT NULL
    COMMENT '转发聚合订阅token';
