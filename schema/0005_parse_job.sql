-- 0005_parse_job.sql · 解析任务历史（只增不改：不碰前四份迁移的任何表、列、CHECK、触发器）
--
-- 为什么单独一张表：只有 document.status 的话，用户点十次"重新解析"在库里看不出痕迹，
-- 事后无法回答"这份报告到底试过几次、每次为什么失败"。
--
-- 三个约定：
--   · **「解析中」不写进库**：进程退出会留下永远转圈的僵尸状态，库里只允许出现终态。
--   · 重试新增一行，旧的失败记录保留（不更新、不删除）。
--   · 失败也留 error_code / error_message：界面上"文件坏了"与"不是肝的报告"必须能分开。
CREATE TABLE parse_job (
  id              INTEGER PRIMARY KEY,
  document_id     INTEGER NOT NULL REFERENCES document(id) ON DELETE CASCADE,
  engine          TEXT NOT NULL CHECK (engine IN ('local','mineru')),
  model           TEXT,
  status          TEXT NOT NULL CHECK (status IN ('succeeded','failed')),
  error_code      TEXT,
  error_message   TEXT,
  pages           INTEGER,
  candidate_count INTEGER NOT NULL DEFAULT 0,
  elapsed_ms      INTEGER,
  started_at      TEXT NOT NULL,
  finished_at     TEXT
);

CREATE INDEX ix_parse_job_doc ON parse_job(document_id);
