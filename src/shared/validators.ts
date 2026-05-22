// Date validation function
export function validateBirthDate(dateStr: string): { isValid: boolean; age?: number; error?: string } {
  // Check format DD/MM/YYYY
  const datePattern = /^(\d{2})\/(\d{2})\/(\d{4})$/;
  const match = dateStr.match(datePattern);
  
  if (!match) {
    return { isValid: false, error: "Formato inválido. Use DD/MM/AAAA" };
  }
  
  const day = parseInt(match[1], 10);
  const month = parseInt(match[2], 10);
  const year = parseInt(match[3], 10);
  
  // Check if valid date
  if (month < 1 || month > 12) {
    return { isValid: false, error: "Mês inválido" };
  }
  
  if (day < 1 || day > 31) {
    return { isValid: false, error: "Dia inválido" };
  }
  
  // Check days in month
  const daysInMonth = new Date(year, month, 0).getDate();
  if (day > daysInMonth) {
    return { isValid: false, error: "Data inválida para este mês" };
  }
  
  // Calculate age
  const today = new Date();
  const birthDate = new Date(year, month - 1, day);
  
  if (birthDate > today) {
    return { isValid: false, error: "Data não pode ser no futuro" };
  }
  
  let age = today.getFullYear() - birthDate.getFullYear();
  const monthDiff = today.getMonth() - birthDate.getMonth();
  
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
    age--;
  }
  
  // Check age range (18 to 100)
  if (age < 18) {
    return { isValid: false, error: "Você deve ter pelo menos 18 anos" };
  }
  
  if (age > 100) {
    return { isValid: false, error: "Idade inválida" };
  }
  
  return { isValid: true, age };
}

// CPF validation function
export function validateCPF(cpf: string): boolean {
  // Remove non-digits
  const cleanCPF = cpf.replace(/\D/g, "");
  
  // Check if has 11 digits
  if (cleanCPF.length !== 11) {
    return false;
  }
  
  // Check if all digits are the same (invalid CPFs like 111.111.111-11)
  if (/^(\d)\1{10}$/.test(cleanCPF)) {
    return false;
  }
  
  // Validate check digits
  let sum = 0;
  let remainder;
  
  // First check digit
  for (let i = 1; i <= 9; i++) {
    sum += parseInt(cleanCPF.substring(i - 1, i)) * (11 - i);
  }
  
  remainder = (sum * 10) % 11;
  if (remainder === 10 || remainder === 11) {
    remainder = 0;
  }
  
  if (remainder !== parseInt(cleanCPF.substring(9, 10))) {
    return false;
  }
  
  sum = 0;
  
  // Second check digit
  for (let i = 1; i <= 10; i++) {
    sum += parseInt(cleanCPF.substring(i - 1, i)) * (12 - i);
  }
  
  remainder = (sum * 10) % 11;
  if (remainder === 10 || remainder === 11) {
    remainder = 0;
  }
  
  if (remainder !== parseInt(cleanCPF.substring(10, 11))) {
    return false;
  }
  
  return true;
}
