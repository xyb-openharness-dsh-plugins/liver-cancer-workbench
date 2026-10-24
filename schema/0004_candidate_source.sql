-- 0004_candidate_source.sql · 候选必须能回看原文（只增不改）
--
-- 0003 让 document 记住了"为什么被拒"，但候选本身还是光秃秃的数字：
-- 界面上只有「白蛋白 38 g/L」和「确认」，用户没有原文可核对。
-- 「只给依据」的底线在这条链路上就断了——他无法判断 38 是不是 OCR 把 36 读错了。
--
-- 同时补 note：抽取时"数值超出常见范围，请核对原文"这条提示原来只活在内存里，
-- 落库就丢了，确认界面看不到，等于白算了一次范围判断。

ALTER TABLE candidate ADD COLUMN source_line TEXT;
ALTER TABLE candidate ADD COLUMN note TEXT;
