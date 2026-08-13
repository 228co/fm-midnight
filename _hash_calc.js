const crypto = require('crypto');
function sha(s) {
  return crypto.createHash('sha256').update(s, 'utf8').digest('hex');
}
const items = [
  '林晚',
  '夜莺',
  '换我了',
  '四层半',
  '陈念',
  '孤灯夜雨闻莺语半不似人声',
  '我不是夜莺',
  '回声',
  '我们',
  'dont say my name',
];
for (const t of items) {
  console.log(JSON.stringify(t), '=>', sha(t));
}
