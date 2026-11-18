# แบ่งเจ้าของข้อมูล Task ระหว่าง Vault กับ Helm ตามฟิลด์

Vault sync ให้ Vault เป็นเจ้าของนิยามงาน (External key, ชื่อ, depends_on) และ Helm เป็นเจ้าของความเคลื่อนไหว (status, assignee, due date) ซิงก์สองทิศแบบ "เจ้าของฟิลด์ชนะ" ไม่ merge ตัวซิงก์เป็นคำสั่งเดียว (`bun run sync`) ที่รันมือตอนปล่อยงานและอ่านทั้งสองฝั่ง และแก้เฉพาะบรรทัด frontmatter ของฟิลด์ที่ Helm เป็นเจ้าของ

## Considered Options

- Helm เป็นแหล่งความจริงทั้งหมด: ถูกปฏิเสธ เพราะนิยามงาน, Use Case และเอกสารอ้างอิงเขียนใน Obsidian และ dotpm อ่านจากไฟล์
- Vault เป็นแหล่งความจริงทั้งหมด: ถูกปฏิเสธ เพราะสถานะและกำหนดเสร็จเปลี่ยนบ่อยใน Helm (Team focus, ทดสอบ, แจ้งเตือน)
- แก้สถานะผ่าน dotpm: ถูกปฏิเสธ เพราะ dotpm เขียน frontmatter ใหม่และเปลี่ยนชื่อไฟล์เป็น slug ทำให้ wikilink พัง

## Consequences

- `status` ในไฟล์ Task เป็นค่าที่ซิงก์มาจาก Helm ห้ามแก้มือ (ต้องแก้ข้อ 7 ของ skill `plan-customer`)
- รหัสงานคือกุญแจจับคู่ การเปลี่ยนรหัสในไฟล์ = Task ใหม่ ตัวเก่าค้างใน Helm
- ลบไฟล์ใน Vault ไม่ลบ Task ใน Helm (ตั้ง cancelled) และกลับกัน (ตั้ง superseded)
- รันมือตอนปล่อยงาน (ไม่มี poller/Docker) และรันทีละเครื่อง เพราะ Vault กระจายด้วย Syncthing และมี conflict copy อยู่แล้ว
