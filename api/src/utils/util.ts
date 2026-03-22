export const randomString = (len = 32, type='alphanumeric') => {
  const charset = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  const buffer = new Uint32Array(len);
  crypto.getRandomValues(buffer);
  
  return Array.from(buffer)
    .map((value) => charset[value % charset.length])
    .join('');
};