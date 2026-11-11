-- ==========================================================
-- RTMS (Room & Tenant Management System) - PostgreSQL DDL
-- ==========================================================

-- ENUMS
CREATE TYPE "Role" AS ENUM ('LANDLORD', 'TENANT');
CREATE TYPE "UserStatus" AS ENUM ('HOAT_DONG', 'DA_TRA_PHONG_KHOA');
CREATE TYPE "RoomStatus" AS ENUM ('TRONG', 'DANG_THUE', 'DA_COC', 'SUA_CHUA');
CREATE TYPE "ServiceType" AS ENUM ('BAT_BUOC', 'TUY_CHON');
CREATE TYPE "ContractStatus" AS ENUM ('HIEU_LUC', 'SAP_HET_HAN', 'HET_HIEU_LUC');
CREATE TYPE "RenewStatus" AS ENUM ('NONE', 'PENDING', 'APPROVED');
CREATE TYPE "InvoiceStatus" AS ENUM ('DA_THANH_TOAN', 'CHUA_THANH_TOAN');
CREATE TYPE "PaymentStatus" AS ENUM ('DA_THANH_TOAN', 'CHO_THANH_TOAN', 'DA_DUYET');
CREATE TYPE "IssueStatus" AS ENUM ('CHO_XU_LY', 'DA_XU_LY');

-- 1. ROOMS
CREATE TABLE "rooms" (
    "id" VARCHAR(50) PRIMARY KEY,
    "name" VARCHAR(100) NOT NULL,
    "floor" INT NOT NULL,
    "area" DOUBLE PRECISION NOT NULL,
    "price" INT NOT NULL,
    "status" "RoomStatus" DEFAULT 'TRONG' NOT NULL,
    "tenant_name" VARCHAR(150),
    "deposit_tenant_name" VARCHAR(150),
    "deposit_tenant_phone" VARCHAR(20),
    "deposit_tenant_amount" INT,
    "repair_content" TEXT,
    "repair_target_date" TIMESTAMP(3),
    "repair_note" TEXT,
    "created_at" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updated_at" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP NOT NULL
);

-- 2. USERS
CREATE TABLE "users" (
    "id" VARCHAR(50) PRIMARY KEY,
    "username" VARCHAR(100) UNIQUE NOT NULL,
    "password_hash" VARCHAR(255) NOT NULL,
    "role" "Role" DEFAULT 'TENANT' NOT NULL,
    "name" VARCHAR(150) NOT NULL,
    "cccd" VARCHAR(20),
    "phone" VARCHAR(20),
    "email" VARCHAR(150),
    "status" "UserStatus" DEFAULT 'HOAT_DONG' NOT NULL,
    "room_id" VARCHAR(50) REFERENCES "rooms"("id") ON DELETE SET NULL,
    "created_at" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updated_at" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP NOT NULL
);

-- 3. LANDLORD PROFILES
CREATE TABLE "landlord_profiles" (
    "id" VARCHAR(50) PRIMARY KEY,
    "user_id" VARCHAR(50) UNIQUE NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
    "name" VARCHAR(150) NOT NULL,
    "phone" VARCHAR(20),
    "email" VARCHAR(150),
    "address" TEXT,
    "cccd" VARCHAR(20),
    "cccd_front_url" TEXT,
    "cccd_back_url" TEXT,
    "bank_name" VARCHAR(100),
    "bank_account" VARCHAR(50),
    "bank_owner" VARCHAR(150),
    "qr_img_url" TEXT,
    "avatar_url" TEXT
);

-- 4. SERVICES
CREATE TABLE "services" (
    "id" VARCHAR(50) PRIMARY KEY,
    "name" VARCHAR(100) NOT NULL,
    "price" INT NOT NULL,
    "unit" VARCHAR(50) NOT NULL,
    "type" "ServiceType" DEFAULT 'BAT_BUOC' NOT NULL,
    "created_at" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updated_at" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP NOT NULL
);

-- 5. CONTRACTS
CREATE TABLE "contracts" (
    "id" VARCHAR(50) PRIMARY KEY,
    "room_id" VARCHAR(50) NOT NULL REFERENCES "rooms"("id"),
    "room_price" INT NOT NULL,
    "landlord_name" VARCHAR(150) NOT NULL,
    "landlord_phone" VARCHAR(20),
    "landlord_cccd" VARCHAR(20),
    "landlord_address" TEXT,
    "tenant_name" VARCHAR(150) NOT NULL,
    "tenant_phone" VARCHAR(20),
    "tenant_cccd" VARCHAR(20),
    "tenant_email" VARCHAR(150),
    "cccd_front_img" TEXT,
    "cccd_back_img" TEXT,
    "start_date" TIMESTAMP(3) NOT NULL,
    "duration" INT NOT NULL,
    "deposit" INT NOT NULL,
    "status" "ContractStatus" DEFAULT 'HIEU_LUC' NOT NULL,
    "services" JSONB,
    "custom_prices" JSONB,
    "elec_old" INT DEFAULT 0 NOT NULL,
    "renew_status" "RenewStatus" DEFAULT 'NONE' NOT NULL,
    "pending_renew_months" INT,
    "created_at" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updated_at" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP NOT NULL
);

-- 6. INVOICES
CREATE TABLE "invoices" (
    "id" VARCHAR(50) PRIMARY KEY,
    "room_id" VARCHAR(50) NOT NULL REFERENCES "rooms"("id"),
    "period" VARCHAR(20) NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "due_date" TIMESTAMP(3) NOT NULL,
    "total" INT NOT NULL,
    "status" "InvoiceStatus" DEFAULT 'CHUA_THANH_TOAN' NOT NULL,
    "elec_old" INT NOT NULL,
    "elec_new" INT NOT NULL,
    "surcharge" INT DEFAULT 0 NOT NULL,
    "surcharge_reason" TEXT,
    "created_at" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updated_at" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP NOT NULL
);

-- 7. PAYMENTS
CREATE TABLE "payments" (
    "id" VARCHAR(50) PRIMARY KEY,
    "inv_id" VARCHAR(50) NOT NULL REFERENCES "invoices"("id"),
    "date" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "amount" INT NOT NULL,
    "method" VARCHAR(100) NOT NULL,
    "ref_no" VARCHAR(100),
    "status" "PaymentStatus" DEFAULT 'DA_THANH_TOAN' NOT NULL,
    "created_at" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP NOT NULL
);

-- 8. POSTS
CREATE TABLE "posts" (
    "id" VARCHAR(50) PRIMARY KEY,
    "title" VARCHAR(255) NOT NULL,
    "content" TEXT NOT NULL,
    "date" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "read_by_tenants" JSONB DEFAULT '[]'::jsonb NOT NULL,
    "created_at" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updated_at" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP NOT NULL
);

-- 9. ISSUES
CREATE TABLE "issues" (
    "id" VARCHAR(50) PRIMARY KEY,
    "loai_su_co" VARCHAR(100) NOT NULL,
    "mo_ta" TEXT NOT NULL,
    "hinh_anh_url" TEXT,
    "ngay_tao" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "trang_thai" "IssueStatus" DEFAULT 'CHO_XU_LY' NOT NULL,
    "ma_phong" VARCHAR(50) NOT NULL REFERENCES "rooms"("id"),
    "ma_nguoi_dung" VARCHAR(50) REFERENCES "users"("id")
);

-- 10. CHAT MESSAGES
CREATE TABLE "chat_messages" (
    "id" VARCHAR(50) PRIMARY KEY,
    "room_id" VARCHAR(50) NOT NULL REFERENCES "rooms"("id"),
    "sender_role" VARCHAR(20) NOT NULL,
    "text" TEXT NOT NULL,
    "time" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "is_read" BOOLEAN DEFAULT FALSE NOT NULL
);

