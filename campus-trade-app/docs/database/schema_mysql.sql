-- 校园二手交易平台 MySQL 8.0 数据库设计
-- 字符集：utf8mb4，排序规则：utf8mb4_0900_ai_ci

CREATE DATABASE IF NOT EXISTS campus_trade
  DEFAULT CHARACTER SET utf8mb4
  COLLATE utf8mb4_0900_ai_ci;

USE campus_trade;

SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;

DROP TABLE IF EXISTS ct_message;
DROP TABLE IF EXISTS ct_conversation;
DROP TABLE IF EXISTS ct_order_status_log;
DROP TABLE IF EXISTS ct_order;
DROP TABLE IF EXISTS ct_favorite;
DROP TABLE IF EXISTS ct_listing_image;
DROP TABLE IF EXISTS ct_listing_review;
DROP TABLE IF EXISTS ct_listing;
DROP TABLE IF EXISTS ct_user_verify;
DROP TABLE IF EXISTS ct_user;
DROP TABLE IF EXISTS ct_category;
DROP TABLE IF EXISTS ct_campus;

SET FOREIGN_KEY_CHECKS = 1;

-- 校区字典
CREATE TABLE ct_campus (
  campus_id BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT COMMENT '校区主键',
  campus_code VARCHAR(32) NOT NULL COMMENT '校区编码',
  campus_name VARCHAR(64) NOT NULL COMMENT '校区名称',
  is_active TINYINT NOT NULL DEFAULT 1 COMMENT '是否启用：1是0否',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uk_campus_code (campus_code)
) ENGINE=InnoDB COMMENT='校区字典表';

-- 商品分类字典
CREATE TABLE ct_category (
  category_id BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT COMMENT '分类主键',
  category_name VARCHAR(64) NOT NULL COMMENT '分类名称',
  sort_no INT NOT NULL DEFAULT 0 COMMENT '排序号',
  is_active TINYINT NOT NULL DEFAULT 1 COMMENT '是否启用：1是0否',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uk_category_name (category_name)
) ENGINE=InnoDB COMMENT='商品分类字典表';

-- 平台用户表（学生/管理员共表）
CREATE TABLE ct_user (
  user_id BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT COMMENT '用户主键',
  student_no VARCHAR(32) NULL COMMENT '学号（学生必填）',
  username VARCHAR(64) NOT NULL COMMENT '昵称',
  password_hash VARCHAR(255) NOT NULL COMMENT '密码哈希',
  phone VARCHAR(20) NULL COMMENT '手机号',
  email VARCHAR(128) NULL COMMENT '邮箱',
  avatar_url VARCHAR(255) NULL COMMENT '头像地址',
  campus_id BIGINT UNSIGNED NULL COMMENT '所属校区',
  role_type TINYINT NOT NULL DEFAULT 1 COMMENT '角色：1学生2管理员',
  user_status TINYINT NOT NULL DEFAULT 1 COMMENT '状态：1正常2禁用',
  verified_status TINYINT NOT NULL DEFAULT 0 COMMENT '认证状态：0未认证1已认证',
  credit_score DECIMAL(3,2) NOT NULL DEFAULT 5.00 COMMENT '信用分（0-5）',
  reg_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '注册时间',
  last_login_at DATETIME NULL COMMENT '最后登录时间',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  deleted_at DATETIME NULL COMMENT '软删除时间',
  CONSTRAINT fk_user_campus FOREIGN KEY (campus_id) REFERENCES ct_campus(campus_id),
  UNIQUE KEY uk_student_no (student_no),
  KEY idx_user_status (user_status),
  KEY idx_user_role (role_type),
  KEY idx_user_campus_status (campus_id, user_status)
) ENGINE=InnoDB COMMENT='用户表';

-- 校园认证记录（保留审核轨迹）
CREATE TABLE ct_user_verify (
  verify_id BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT COMMENT '认证记录主键',
  user_id BIGINT UNSIGNED NOT NULL COMMENT '用户ID',
  real_name VARCHAR(64) NOT NULL COMMENT '真实姓名',
  student_no VARCHAR(32) NOT NULL COMMENT '学号',
  id_card_mask VARCHAR(64) NULL COMMENT '证件号脱敏值',
  student_card_image VARCHAR(255) NULL COMMENT '学生证图片',
  verify_status TINYINT NOT NULL DEFAULT 0 COMMENT '状态：0待审1通过2驳回',
  reviewer_id BIGINT UNSIGNED NULL COMMENT '审核人ID（管理员）',
  reviewed_at DATETIME NULL COMMENT '审核时间',
  reject_reason VARCHAR(255) NULL COMMENT '驳回原因',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_verify_user FOREIGN KEY (user_id) REFERENCES ct_user(user_id),
  CONSTRAINT fk_verify_reviewer FOREIGN KEY (reviewer_id) REFERENCES ct_user(user_id),
  KEY idx_verify_user_status (user_id, verify_status),
  KEY idx_verify_created (created_at)
) ENGINE=InnoDB COMMENT='校园认证审核记录表';

-- 商品主表
CREATE TABLE ct_listing (
  listing_id BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT COMMENT '商品ID',
  seller_id BIGINT UNSIGNED NOT NULL COMMENT '卖家ID',
  category_id BIGINT UNSIGNED NOT NULL COMMENT '分类ID',
  campus_id BIGINT UNSIGNED NOT NULL COMMENT '校区ID',
  title VARCHAR(128) NOT NULL COMMENT '标题',
  description TEXT NULL COMMENT '描述',
  price DECIMAL(10,2) NOT NULL COMMENT '价格',
  quality_score DECIMAL(3,1) NOT NULL DEFAULT 9.0 COMMENT '成色（0-10）',
  shipping_type TINYINT NOT NULL DEFAULT 1 COMMENT '物流：1包邮2不包邮3自取',
  trade_method TINYINT NOT NULL DEFAULT 1 COMMENT '交易方式：1面交2快递3面交+快递',
  listing_status TINYINT NOT NULL DEFAULT 1 COMMENT '状态：0草稿1待审核2上架3已售4下架5驳回',
  review_remark VARCHAR(255) NULL COMMENT '审核备注',
  view_count INT NOT NULL DEFAULT 0 COMMENT '浏览量',
  favorite_count INT NOT NULL DEFAULT 0 COMMENT '收藏量',
  published_at DATETIME NULL COMMENT '上架时间',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  deleted_at DATETIME NULL COMMENT '软删除时间',
  CONSTRAINT fk_listing_seller FOREIGN KEY (seller_id) REFERENCES ct_user(user_id),
  CONSTRAINT fk_listing_category FOREIGN KEY (category_id) REFERENCES ct_category(category_id),
  CONSTRAINT fk_listing_campus FOREIGN KEY (campus_id) REFERENCES ct_campus(campus_id),
  KEY idx_listing_status_created (listing_status, created_at),
  KEY idx_listing_seller_status (seller_id, listing_status),
  KEY idx_listing_category_status (category_id, listing_status),
  KEY idx_listing_campus_status (campus_id, listing_status),
  KEY idx_listing_price (price)
) ENGINE=InnoDB COMMENT='商品表';

-- 商品图片表（1:N）
CREATE TABLE ct_listing_image (
  image_id BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT COMMENT '图片ID',
  listing_id BIGINT UNSIGNED NOT NULL COMMENT '商品ID',
  image_url VARCHAR(255) NOT NULL COMMENT '图片URL',
  is_cover TINYINT NOT NULL DEFAULT 0 COMMENT '是否主图：1是0否',
  sort_no INT NOT NULL DEFAULT 0 COMMENT '排序号',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_listing_image_listing FOREIGN KEY (listing_id) REFERENCES ct_listing(listing_id),
  KEY idx_listing_image_listing (listing_id, sort_no)
) ENGINE=InnoDB COMMENT='商品图片表';

-- 商品审核记录
CREATE TABLE ct_listing_review (
  review_id BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT COMMENT '审核记录ID',
  listing_id BIGINT UNSIGNED NOT NULL COMMENT '商品ID',
  reviewer_id BIGINT UNSIGNED NOT NULL COMMENT '审核人ID',
  review_result TINYINT NOT NULL COMMENT '审核结果：1通过2驳回',
  review_reason VARCHAR(255) NULL COMMENT '审核备注',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_listing_review_listing FOREIGN KEY (listing_id) REFERENCES ct_listing(listing_id),
  CONSTRAINT fk_listing_review_user FOREIGN KEY (reviewer_id) REFERENCES ct_user(user_id),
  KEY idx_listing_review_listing (listing_id),
  KEY idx_listing_review_created (created_at)
) ENGINE=InnoDB COMMENT='商品审核记录表';

-- 收藏关系表（用户与商品多对多）
CREATE TABLE ct_favorite (
  favorite_id BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT COMMENT '收藏ID',
  user_id BIGINT UNSIGNED NOT NULL COMMENT '用户ID',
  listing_id BIGINT UNSIGNED NOT NULL COMMENT '商品ID',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_favorite_user FOREIGN KEY (user_id) REFERENCES ct_user(user_id),
  CONSTRAINT fk_favorite_listing FOREIGN KEY (listing_id) REFERENCES ct_listing(listing_id),
  UNIQUE KEY uk_favorite_user_listing (user_id, listing_id),
  KEY idx_favorite_listing (listing_id)
) ENGINE=InnoDB COMMENT='收藏表';

-- 订单主表
CREATE TABLE ct_order (
  order_id BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT COMMENT '订单ID',
  order_no VARCHAR(40) NOT NULL COMMENT '订单编号',
  listing_id BIGINT UNSIGNED NOT NULL COMMENT '商品ID',
  buyer_id BIGINT UNSIGNED NOT NULL COMMENT '买家ID',
  seller_id BIGINT UNSIGNED NOT NULL COMMENT '卖家ID',
  order_amount DECIMAL(10,2) NOT NULL COMMENT '成交金额',
  order_status TINYINT NOT NULL DEFAULT 0 COMMENT '状态：0待确认1已确认2进行中3已完成4已取消5已拒绝',
  trade_method TINYINT NOT NULL DEFAULT 1 COMMENT '交易方式：1面交2快递3面交+快递',
  trade_address VARCHAR(255) NULL COMMENT '交易地点/收货地址',
  cancel_reason VARCHAR(255) NULL COMMENT '取消原因',
  finished_at DATETIME NULL COMMENT '完成时间',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_order_listing FOREIGN KEY (listing_id) REFERENCES ct_listing(listing_id),
  CONSTRAINT fk_order_buyer FOREIGN KEY (buyer_id) REFERENCES ct_user(user_id),
  CONSTRAINT fk_order_seller FOREIGN KEY (seller_id) REFERENCES ct_user(user_id),
  UNIQUE KEY uk_order_no (order_no),
  KEY idx_order_buyer_status (buyer_id, order_status),
  KEY idx_order_seller_status (seller_id, order_status),
  KEY idx_order_created (created_at),
  KEY idx_order_listing (listing_id)
) ENGINE=InnoDB COMMENT='订单表';

-- 订单状态流转日志
CREATE TABLE ct_order_status_log (
  log_id BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT COMMENT '日志ID',
  order_id BIGINT UNSIGNED NOT NULL COMMENT '订单ID',
  from_status TINYINT NULL COMMENT '变更前状态',
  to_status TINYINT NOT NULL COMMENT '变更后状态',
  operator_id BIGINT UNSIGNED NOT NULL COMMENT '操作人ID',
  note VARCHAR(255) NULL COMMENT '备注',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_order_log_order FOREIGN KEY (order_id) REFERENCES ct_order(order_id),
  CONSTRAINT fk_order_log_operator FOREIGN KEY (operator_id) REFERENCES ct_user(user_id),
  KEY idx_order_log_order (order_id, created_at),
  KEY idx_order_log_operator (operator_id)
) ENGINE=InnoDB COMMENT='订单状态日志表';

-- 会话表（按 商品 + 买卖双方 唯一）
CREATE TABLE ct_conversation (
  conversation_id BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT COMMENT '会话ID',
  listing_id BIGINT UNSIGNED NOT NULL COMMENT '关联商品ID',
  buyer_id BIGINT UNSIGNED NOT NULL COMMENT '买家ID',
  seller_id BIGINT UNSIGNED NOT NULL COMMENT '卖家ID',
  last_message_at DATETIME NULL COMMENT '最后消息时间',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_conversation_listing FOREIGN KEY (listing_id) REFERENCES ct_listing(listing_id),
  CONSTRAINT fk_conversation_buyer FOREIGN KEY (buyer_id) REFERENCES ct_user(user_id),
  CONSTRAINT fk_conversation_seller FOREIGN KEY (seller_id) REFERENCES ct_user(user_id),
  UNIQUE KEY uk_conversation_pair (listing_id, buyer_id, seller_id),
  KEY idx_conversation_buyer (buyer_id, updated_at),
  KEY idx_conversation_seller (seller_id, updated_at)
) ENGINE=InnoDB COMMENT='会话表';

-- 消息表
CREATE TABLE ct_message (
  message_id BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT COMMENT '消息ID',
  conversation_id BIGINT UNSIGNED NOT NULL COMMENT '会话ID',
  sender_id BIGINT UNSIGNED NOT NULL COMMENT '发送者ID',
  message_type TINYINT NOT NULL DEFAULT 1 COMMENT '消息类型：1文本2图片3系统',
  message_body TEXT NOT NULL COMMENT '消息内容',
  read_status TINYINT NOT NULL DEFAULT 0 COMMENT '已读状态：0未读1已读',
  sent_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '发送时间',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_message_conversation FOREIGN KEY (conversation_id) REFERENCES ct_conversation(conversation_id),
  CONSTRAINT fk_message_sender FOREIGN KEY (sender_id) REFERENCES ct_user(user_id),
  KEY idx_message_conversation_time (conversation_id, sent_at),
  KEY idx_message_sender (sender_id),
  KEY idx_message_read (read_status)
) ENGINE=InnoDB COMMENT='消息记录表';

-- 初始化基础字典（可按学校实际继续补充）
INSERT INTO ct_campus (campus_code, campus_name) VALUES
('north', '北校区'),
('south', '南校区'),
('east', '东校区');

INSERT INTO ct_category (category_name, sort_no) VALUES
('数码', 10),
('教材', 20),
('生活用品', 30),
('交通工具', 40),
('租房', 50);
