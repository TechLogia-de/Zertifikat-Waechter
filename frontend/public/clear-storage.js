// Clear corrupted localStorage
console.log('🧹 Clearing localStorage...');
const keys = Object.keys(localStorage);
console.log('Found keys:', keys);

keys.forEach(key => {
  if (key.includes('supabase') || key.includes('sb-')) {
    console.log('Removing:', key);
    localStorage.removeItem(key);
  }
});

sessionStorage.clear();
console.log('✅ Storage cleared! Reloading...');
setTimeout(() => location.href = '/', 500);
