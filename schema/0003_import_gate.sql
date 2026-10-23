-- 0003_import_gate.sql · 导入闸门的落点（只增不改）
--
-- 背景：2026-10-24 用一份真实扫描件试跑，抽出来是胰腺穿刺病理。
-- 闸门会把这种文件判成 reject_out_of_domain，但 document.status 只有 parse_failed 一个值，
-- 用户看到"解析失败"分不清是"文件坏了"还是"这不是肝的报告"——这两种要采取的动作完全不同。
--
-- 所以补一列 parse_note 记原因原文。只加列，不动任何既有表结构、CHECK、触发器、索引。

ALTER TABLE document ADD COLUMN parse_note TEXT;

-- 导入队列的默认查询是按档案 + 时间倒序（界面"最近导入"），补一个索引。
-- 候选侧不用加：0001 已有 ix_candidate_doc(document_id, field)，按 document_id 定位后过滤 status 足够。
CREATE INDEX IF NOT EXISTS idx_document_profile_uploaded
  ON document (profile_id, uploaded_at DESC);
