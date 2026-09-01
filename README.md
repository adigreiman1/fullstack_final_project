# Service Mobility Dashboard 🚚

מערכת Full-Stack לניהול ותזמון משימות שירות בשטח (Route Optimization & Fleet Management), המבוססת על Next.js, Supabase ו-Mapbox.

## 🚀 הערה לבודק הפרויקט (Demo Mode)

המערכת מתוכננת להציג נתונים בזמן אמת מתוך מאגר הנתונים הארגוני (External ERP).
כדי לאפשר בדיקה מקיפה ונוחה של כל יכולות המערכת – כולל אלגוריתם הניווט של Mapbox, תצוגה של ריבוי ניידות, התמודדות עם מקרי קצה, וחריגה ממגבלת 12 נקודות הציון של ה-API – הזרקנו **Mock Data המדמה שבוע פעילות עמוס ומרשים מתאריך 01/09/2026 ועד 07/09/2026**. 

(המלצה: ימים 04/09 ו-05/09 כוללים מקרי קצה של ניידת עם תחנה בודדת וניידת עם 13 תחנות, להדגמת התמודדות עם מגבלות ה-API).

**חוויית משתמש (Empty State):** במידה ותיכנסו למערכת בתאריך שאין בו נתונים מתוזמנים, המערכת תזהה זאת אוטומטית ותציג מסך Empty State ידידותי. במסך זה תמצאו כפתור שיעביר אתכם ישירות לתחילת שבוע ההדגמה, ללא צורך בחיפוש ידני בלוח השנה.

---

## Getting Started

This is a [Next.js](https://nextjs.org) project bootstrapped with `create-next-app`.

First, run the development server:
`npm run dev`

Open http://localhost:3000 with your browser to see the result.
You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.