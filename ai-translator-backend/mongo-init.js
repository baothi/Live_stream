// ==========================================
// MongoDB Init Script
// Tao database va user khi container khoi dong lan dau
// ==========================================

db = db.getSiblingDB('ai-translator');

db.createCollection('users');

print('✅ Database ai-translator initialized');
