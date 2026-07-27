-- after_sales / SAV production schema. Target: MySQL 8.0.21+ (InnoDB, utf8mb4).
-- Store application timestamps in UTC; translate in the application layer.
CREATE DATABASE IF NOT EXISTS after_sales CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;
USE after_sales;

CREATE TABLE roles (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  code VARCHAR(80) NOT NULL, name VARCHAR(120) NOT NULL, description VARCHAR(500) NULL,
  is_system BOOLEAN NOT NULL DEFAULT FALSE, created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT uq_roles_code UNIQUE (code), CONSTRAINT ck_roles_code CHECK (code REGEXP '^[a-z][a-z0-9_.-]{1,79}$')
) ENGINE=InnoDB;

CREATE TABLE permissions (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  code VARCHAR(120) NOT NULL, description VARCHAR(500) NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT uq_permissions_code UNIQUE (code), CONSTRAINT ck_permissions_code CHECK (code REGEXP '^[a-z][a-z0-9_.-]{2,119}$')
) ENGINE=InnoDB;

CREATE TABLE users (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  public_id BINARY(16) NOT NULL DEFAULT (UUID_TO_BIN(UUID(), 1)),
  email VARCHAR(254) NOT NULL, password VARCHAR(255) NOT NULL, first_name VARCHAR(100) NOT NULL,
  last_name VARCHAR(100) NOT NULL, phone VARCHAR(30) NULL, locale VARCHAR(10) NOT NULL DEFAULT 'en',
  timezone VARCHAR(64) NOT NULL DEFAULT 'UTC', status ENUM('active','invited','suspended','archived') NOT NULL DEFAULT 'invited',
  email_verified_at TIMESTAMP NULL, last_login_at TIMESTAMP NULL, deleted_at TIMESTAMP NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT uq_users_public_id UNIQUE (public_id), CONSTRAINT uq_users_email UNIQUE (email),
  CONSTRAINT ck_users_email CHECK (email LIKE '%_@_%._%')
) ENGINE=InnoDB;
CREATE INDEX ix_users_status_created ON users(status, created_at);

CREATE TABLE user_roles (
  user_id BIGINT UNSIGNED NOT NULL, role_id BIGINT UNSIGNED NOT NULL, assigned_by BIGINT UNSIGNED NULL,
  assigned_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP, PRIMARY KEY (user_id, role_id),
  CONSTRAINT fk_ur_user FOREIGN KEY (user_id) REFERENCES users(id),
  CONSTRAINT fk_ur_role FOREIGN KEY (role_id) REFERENCES roles(id),
  CONSTRAINT fk_ur_assigned_by FOREIGN KEY (assigned_by) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB;
CREATE TABLE role_permissions (
  role_id BIGINT UNSIGNED NOT NULL, permission_id BIGINT UNSIGNED NOT NULL,
  PRIMARY KEY (role_id, permission_id),
  CONSTRAINT fk_rp_role FOREIGN KEY (role_id) REFERENCES roles(id),
  CONSTRAINT fk_rp_permission FOREIGN KEY (permission_id) REFERENCES permissions(id)
) ENGINE=InnoDB;

CREATE TABLE clients (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY, public_id BINARY(16) NOT NULL DEFAULT (UUID_TO_BIN(UUID(), 1)),
  client_type ENUM('individual','business') NOT NULL, company_name VARCHAR(180) NULL,
  first_name VARCHAR(100) NULL, last_name VARCHAR(100) NULL, email VARCHAR(254) NULL, phone VARCHAR(30) NULL,
  tax_id VARCHAR(80) NULL, status ENUM('active','inactive','blocked') NOT NULL DEFAULT 'active',
  created_by BIGINT UNSIGNED NULL, deleted_at TIMESTAMP NULL, created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT uq_clients_public_id UNIQUE(public_id), CONSTRAINT uq_clients_tax_id UNIQUE(tax_id),
  CONSTRAINT ck_client_identity CHECK ((client_type='business' AND company_name IS NOT NULL) OR (client_type='individual' AND first_name IS NOT NULL AND last_name IS NOT NULL)),
  CONSTRAINT fk_clients_created_by FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB;
CREATE INDEX ix_clients_name ON clients(last_name, first_name); CREATE INDEX ix_clients_email ON clients(email);

CREATE TABLE client_addresses (
 id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY, client_id BIGINT UNSIGNED NOT NULL, label VARCHAR(80) NOT NULL DEFAULT 'primary',
 line1 VARCHAR(160) NOT NULL, line2 VARCHAR(160) NULL, city VARCHAR(100) NOT NULL, region VARCHAR(100) NULL,
 postal_code VARCHAR(24) NULL, country_code CHAR(2) NOT NULL, is_default BOOLEAN NOT NULL DEFAULT FALSE,
 default_client_id BIGINT UNSIGNED GENERATED ALWAYS AS (IF(is_default, client_id, NULL)) STORED,
 created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
 CONSTRAINT fk_address_client FOREIGN KEY(client_id) REFERENCES clients(id) ON DELETE CASCADE,
 CONSTRAINT ck_address_country CHECK(country_code REGEXP '^[A-Z]{2}$')
) ENGINE=InnoDB;
CREATE UNIQUE INDEX uq_default_client_address ON client_addresses(default_client_id);

CREATE TABLE brands (id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY, name VARCHAR(120) NOT NULL, slug VARCHAR(140) NOT NULL,
 website VARCHAR(2048) NULL, is_active BOOLEAN NOT NULL DEFAULT TRUE, created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
 updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP, UNIQUE KEY uq_brands_name(name), UNIQUE KEY uq_brands_slug(slug)) ENGINE=InnoDB;
CREATE TABLE categories (id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY, parent_id BIGINT UNSIGNED NULL, name VARCHAR(120) NOT NULL, slug VARCHAR(140) NOT NULL,
 description VARCHAR(500) NULL, is_active BOOLEAN NOT NULL DEFAULT TRUE, created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
 updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
 UNIQUE KEY uq_categories_slug(slug), CONSTRAINT fk_category_parent FOREIGN KEY(parent_id) REFERENCES categories(id) ON DELETE SET NULL) ENGINE=InnoDB;
CREATE INDEX ix_categories_parent ON categories(parent_id);
CREATE TABLE products (
 id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY, public_id BINARY(16) NOT NULL DEFAULT (UUID_TO_BIN(UUID(),1)), brand_id BIGINT UNSIGNED NULL, category_id BIGINT UNSIGNED NOT NULL,
 sku VARCHAR(100) NOT NULL, name VARCHAR(180) NOT NULL, model_number VARCHAR(120) NULL, description TEXT NULL,
 is_active BOOLEAN NOT NULL DEFAULT TRUE, created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
 UNIQUE KEY uq_products_public_id(public_id), UNIQUE KEY uq_products_sku(sku), KEY ix_products_brand_category(brand_id,category_id),
 CONSTRAINT fk_product_brand FOREIGN KEY(brand_id) REFERENCES brands(id) ON DELETE SET NULL, CONSTRAINT fk_product_category FOREIGN KEY(category_id) REFERENCES categories(id)
) ENGINE=InnoDB;
CREATE TABLE warranties (
 id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY, product_id BIGINT UNSIGNED NOT NULL, client_id BIGINT UNSIGNED NOT NULL, serial_number VARCHAR(150) NOT NULL,
 purchase_date DATE NOT NULL, starts_on DATE NOT NULL, ends_on DATE NOT NULL,
 status ENUM('active','expired','void','claimed') NOT NULL DEFAULT 'active', created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
 UNIQUE KEY uq_warranty_serial(serial_number), KEY ix_warranty_client_status(client_id,status), KEY ix_warranty_expiry(status,ends_on),
 CONSTRAINT ck_warranty_dates CHECK(ends_on >= starts_on AND starts_on >= purchase_date),
 CONSTRAINT fk_warranty_product FOREIGN KEY(product_id) REFERENCES products(id), CONSTRAINT fk_warranty_client FOREIGN KEY(client_id) REFERENCES clients(id)
) ENGINE=InnoDB;

CREATE TABLE technicians (
 id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY, user_id BIGINT UNSIGNED NOT NULL, employee_code VARCHAR(60) NOT NULL,
 specialization VARCHAR(255) NULL, capacity_hours_per_day DECIMAL(5,2) NOT NULL DEFAULT 8.00, is_available BOOLEAN NOT NULL DEFAULT TRUE,
 created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
 UNIQUE KEY uq_technician_user(user_id), UNIQUE KEY uq_technician_code(employee_code), CONSTRAINT ck_tech_capacity CHECK(capacity_hours_per_day > 0), CONSTRAINT fk_tech_user FOREIGN KEY(user_id) REFERENCES users(id)
) ENGINE=InnoDB;

CREATE TABLE tickets (
 id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY, public_id BINARY(16) NOT NULL DEFAULT (UUID_TO_BIN(UUID(),1)), ticket_number VARCHAR(32) NOT NULL,
 client_id BIGINT UNSIGNED NOT NULL, opened_by BIGINT UNSIGNED NULL, assigned_technician_id BIGINT UNSIGNED NULL,
 subject VARCHAR(255) NOT NULL, description TEXT NOT NULL, channel ENUM('web','phone','email','walk_in','api') NOT NULL DEFAULT 'web',
 priority ENUM('low','normal','high','urgent') NOT NULL DEFAULT 'normal', status ENUM('new','open','pending_client','in_progress','resolved','closed','cancelled') NOT NULL DEFAULT 'new',
 due_at TIMESTAMP NULL, resolved_at TIMESTAMP NULL, closed_at TIMESTAMP NULL, deleted_at TIMESTAMP NULL,
 created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
 UNIQUE KEY uq_ticket_public_id(public_id), UNIQUE KEY uq_ticket_number(ticket_number), KEY ix_ticket_queue(status,priority,created_at), KEY ix_ticket_client_created(client_id,created_at), KEY ix_ticket_assignee_status(assigned_technician_id,status), KEY ix_ticket_due(due_at),
 CONSTRAINT ck_ticket_lifecycle CHECK((resolved_at IS NULL OR resolved_at >= created_at) AND (closed_at IS NULL OR closed_at >= created_at)),
 CONSTRAINT fk_ticket_client FOREIGN KEY(client_id) REFERENCES clients(id), CONSTRAINT fk_ticket_opened_by FOREIGN KEY(opened_by) REFERENCES users(id) ON DELETE SET NULL,
 CONSTRAINT fk_ticket_technician FOREIGN KEY(assigned_technician_id) REFERENCES technicians(id) ON DELETE SET NULL
) ENGINE=InnoDB;
CREATE TABLE ticket_products (
 ticket_id BIGINT UNSIGNED NOT NULL, product_id BIGINT UNSIGNED NOT NULL, warranty_id BIGINT UNSIGNED NULL,
 serial_number VARCHAR(150) NULL, issue_notes VARCHAR(1000) NULL, PRIMARY KEY(ticket_id,product_id),
 CONSTRAINT fk_tp_ticket FOREIGN KEY(ticket_id) REFERENCES tickets(id) ON DELETE CASCADE, CONSTRAINT fk_tp_product FOREIGN KEY(product_id) REFERENCES products(id), CONSTRAINT fk_tp_warranty FOREIGN KEY(warranty_id) REFERENCES warranties(id) ON DELETE SET NULL
) ENGINE=InnoDB;

CREATE TABLE repairs (
 id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY, public_id BINARY(16) NOT NULL DEFAULT (UUID_TO_BIN(UUID(),1)), repair_number VARCHAR(32) NOT NULL,
 ticket_id BIGINT UNSIGNED NOT NULL, technician_id BIGINT UNSIGNED NULL, warranty_id BIGINT UNSIGNED NULL,
 diagnosis TEXT NULL, resolution TEXT NULL, estimated_cost DECIMAL(12,2) NOT NULL DEFAULT 0, actual_cost DECIMAL(12,2) NOT NULL DEFAULT 0,
 status ENUM('received','diagnosing','awaiting_parts','awaiting_approval','repairing','quality_check','completed','returned','cancelled') NOT NULL DEFAULT 'received',
 received_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP, started_at TIMESTAMP NULL, completed_at TIMESTAMP NULL, returned_at TIMESTAMP NULL,
 created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
 UNIQUE KEY uq_repair_public_id(public_id), UNIQUE KEY uq_repair_number(repair_number), UNIQUE KEY uq_repair_ticket(ticket_id), KEY ix_repair_tech_status(technician_id,status), KEY ix_repair_status_received(status,received_at),
 CONSTRAINT ck_repair_costs CHECK(estimated_cost >= 0 AND actual_cost >= 0), CONSTRAINT ck_repair_dates CHECK((started_at IS NULL OR started_at >= received_at) AND (completed_at IS NULL OR completed_at >= received_at) AND (returned_at IS NULL OR returned_at >= received_at)),
 CONSTRAINT fk_repair_ticket FOREIGN KEY(ticket_id) REFERENCES tickets(id), CONSTRAINT fk_repair_technician FOREIGN KEY(technician_id) REFERENCES technicians(id) ON DELETE SET NULL, CONSTRAINT fk_repair_warranty FOREIGN KEY(warranty_id) REFERENCES warranties(id) ON DELETE SET NULL
) ENGINE=InnoDB;
CREATE TABLE repair_history (
 id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY, repair_id BIGINT UNSIGNED NOT NULL, actor_user_id BIGINT UNSIGNED NULL,
 event_type ENUM('created','status_changed','assigned','diagnosis_added','estimate_updated','parts_updated','note_added','completed','returned') NOT NULL,
 previous_status VARCHAR(32) NULL, new_status VARCHAR(32) NULL, note TEXT NULL, metadata JSON NULL, created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
 KEY ix_repair_history_repair_created(repair_id,created_at), KEY ix_repair_history_actor(actor_user_id,created_at),
 CONSTRAINT fk_rh_repair FOREIGN KEY(repair_id) REFERENCES repairs(id) ON DELETE CASCADE, CONSTRAINT fk_rh_actor FOREIGN KEY(actor_user_id) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB;

CREATE TABLE invoices (
 id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY, public_id BINARY(16) NOT NULL DEFAULT (UUID_TO_BIN(UUID(),1)), invoice_number VARCHAR(40) NOT NULL,
 client_id BIGINT UNSIGNED NOT NULL, repair_id BIGINT UNSIGNED NULL, status ENUM('draft','issued','partially_paid','paid','void','overdue') NOT NULL DEFAULT 'draft', currency CHAR(3) NOT NULL,
 issued_at TIMESTAMP NULL, due_at TIMESTAMP NULL, paid_at TIMESTAMP NULL, subtotal DECIMAL(12,2) NOT NULL DEFAULT 0, tax_total DECIMAL(12,2) NOT NULL DEFAULT 0, total DECIMAL(12,2) NOT NULL DEFAULT 0, amount_paid DECIMAL(12,2) NOT NULL DEFAULT 0,
 created_by BIGINT UNSIGNED NULL, created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
 UNIQUE KEY uq_invoice_public_id(public_id), UNIQUE KEY uq_invoice_number(invoice_number), UNIQUE KEY uq_invoice_repair(repair_id), KEY ix_invoice_client_status(client_id,status), KEY ix_invoice_due(status,due_at),
 CONSTRAINT ck_invoice_amounts CHECK(subtotal >= 0 AND tax_total >= 0 AND total = subtotal + tax_total AND amount_paid >= 0 AND amount_paid <= total), CONSTRAINT ck_invoice_currency CHECK(currency REGEXP '^[A-Z]{3}$'),
 CONSTRAINT fk_invoice_client FOREIGN KEY(client_id) REFERENCES clients(id), CONSTRAINT fk_invoice_repair FOREIGN KEY(repair_id) REFERENCES repairs(id) ON DELETE SET NULL, CONSTRAINT fk_invoice_creator FOREIGN KEY(created_by) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB;
CREATE TABLE invoice_items (
 id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY, invoice_id BIGINT UNSIGNED NOT NULL, product_id BIGINT UNSIGNED NULL, description VARCHAR(500) NOT NULL, quantity DECIMAL(12,3) NOT NULL,
 unit_price DECIMAL(12,2) NOT NULL, tax_rate DECIMAL(5,2) NOT NULL DEFAULT 0, line_subtotal DECIMAL(12,2) NOT NULL, line_tax DECIMAL(12,2) NOT NULL, line_total DECIMAL(12,2) NOT NULL,
 created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP, KEY ix_invoice_item_invoice(invoice_id), CONSTRAINT ck_invoice_item CHECK(quantity > 0 AND unit_price >= 0 AND tax_rate >= 0 AND line_subtotal >= 0 AND line_tax >= 0 AND line_total = line_subtotal + line_tax), CONSTRAINT fk_invoice_item_invoice FOREIGN KEY(invoice_id) REFERENCES invoices(id) ON DELETE CASCADE, CONSTRAINT fk_invoice_item_product FOREIGN KEY(product_id) REFERENCES products(id) ON DELETE SET NULL
) ENGINE=InnoDB;

CREATE TABLE notifications (
 id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY, user_id BIGINT UNSIGNED NOT NULL, type VARCHAR(120) NOT NULL, channel ENUM('in_app','email','sms','push') NOT NULL DEFAULT 'in_app', title VARCHAR(255) NOT NULL, body TEXT NOT NULL, data JSON NULL, read_at TIMESTAMP NULL, sent_at TIMESTAMP NULL, failed_at TIMESTAMP NULL, created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
 KEY ix_notification_inbox(user_id,read_at,created_at), KEY ix_notification_delivery(channel,sent_at,failed_at), CONSTRAINT fk_notification_user FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB;
CREATE TABLE files (
 id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY, public_id BINARY(16) NOT NULL DEFAULT (UUID_TO_BIN(UUID(),1)), uploaded_by BIGINT UNSIGNED NULL, disk VARCHAR(50) NOT NULL, object_key VARCHAR(1024) NOT NULL, original_name VARCHAR(255) NOT NULL, mime_type VARCHAR(127) NOT NULL, size_bytes BIGINT UNSIGNED NOT NULL, checksum_sha256 CHAR(64) NOT NULL, is_private BOOLEAN NOT NULL DEFAULT TRUE, created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
 UNIQUE KEY uq_file_public_id(public_id), UNIQUE KEY uq_file_object(disk,object_key), KEY ix_file_uploaded_by(uploaded_by,created_at), CONSTRAINT ck_file_size CHECK(size_bytes > 0), CONSTRAINT ck_file_checksum CHECK(checksum_sha256 REGEXP '^[0-9a-f]{64}$'), CONSTRAINT fk_file_uploader FOREIGN KEY(uploaded_by) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB;
CREATE TABLE file_attachments (
 file_id BIGINT UNSIGNED NOT NULL, ticket_id BIGINT UNSIGNED NULL, repair_id BIGINT UNSIGNED NULL, invoice_id BIGINT UNSIGNED NULL, warranty_id BIGINT UNSIGNED NULL, attached_by BIGINT UNSIGNED NULL, created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
 PRIMARY KEY(file_id), KEY ix_attachment_ticket(ticket_id), KEY ix_attachment_repair(repair_id), KEY ix_attachment_invoice(invoice_id),
 CONSTRAINT ck_attachment_target CHECK((ticket_id IS NOT NULL)+(repair_id IS NOT NULL)+(invoice_id IS NOT NULL)+(warranty_id IS NOT NULL)=1),
 CONSTRAINT fk_fa_file FOREIGN KEY(file_id) REFERENCES files(id) ON DELETE CASCADE, CONSTRAINT fk_fa_ticket FOREIGN KEY(ticket_id) REFERENCES tickets(id) ON DELETE CASCADE, CONSTRAINT fk_fa_repair FOREIGN KEY(repair_id) REFERENCES repairs(id) ON DELETE CASCADE, CONSTRAINT fk_fa_invoice FOREIGN KEY(invoice_id) REFERENCES invoices(id) ON DELETE CASCADE, CONSTRAINT fk_fa_warranty FOREIGN KEY(warranty_id) REFERENCES warranties(id) ON DELETE CASCADE, CONSTRAINT fk_fa_user FOREIGN KEY(attached_by) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB;

CREATE TABLE activity_logs (
 id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY, occurred_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP, actor_user_id BIGINT UNSIGNED NULL, action VARCHAR(100) NOT NULL, entity_type VARCHAR(80) NOT NULL, entity_id BIGINT UNSIGNED NULL, request_id CHAR(36) NULL, ip_address VARBINARY(16) NULL, user_agent VARCHAR(1024) NULL, before_data JSON NULL, after_data JSON NULL, metadata JSON NULL,
 KEY ix_log_entity(entity_type,entity_id,occurred_at), KEY ix_log_actor(actor_user_id,occurred_at), KEY ix_log_occurred(occurred_at), CONSTRAINT fk_log_actor FOREIGN KEY(actor_user_id) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB;
CREATE TABLE dashboard_daily_statistics (
 stat_date DATE NOT NULL, metric_name VARCHAR(100) NOT NULL, dimension_key VARCHAR(100) NOT NULL DEFAULT '', dimension_value VARCHAR(100) NOT NULL DEFAULT '', metric_value DECIMAL(20,4) NOT NULL, refreshed_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
 PRIMARY KEY(stat_date,metric_name,dimension_key,dimension_value), KEY ix_dashboard_metric_date(metric_name,stat_date)
) ENGINE=InnoDB;

-- Immutable audit data should be partitioned by occurred_at once it reaches ~10M rows.
-- Keep invoice totals consistent through transactional service code.
