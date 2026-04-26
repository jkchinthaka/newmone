/// Lightweight form-field validators. Each returns null if valid, error otherwise.
class Validators {
  Validators._();

  static final RegExp _emailRegex =
      RegExp(r'^[\w.\-+]+@([\w\-]+\.)+[a-zA-Z]{2,}$');

  static String? required(String? value, {String field = 'This field'}) {
    if (value == null || value.trim().isEmpty) return '$field is required';
    return null;
  }

  static String? email(String? value) {
    if (value == null || value.trim().isEmpty) return 'Email is required';
    if (!_emailRegex.hasMatch(value.trim())) return 'Enter a valid email';
    return null;
  }

  static String? password(String? value, {int minLength = 8}) {
    if (value == null || value.isEmpty) return 'Password is required';
    if (value.length < minLength) {
      return 'Password must be at least $minLength characters';
    }
    return null;
  }

  static String? confirm(String? value, String? other) {
    if (value != other) return 'Passwords do not match';
    return null;
  }

  static String? minLength(String? value, int min, {String field = 'Field'}) {
    if (value == null || value.trim().length < min) {
      return '$field must be at least $min characters';
    }
    return null;
  }

  static String? phone(String? value) {
    if (value == null || value.trim().isEmpty) return 'Phone is required';
    final digits = value.replaceAll(RegExp(r'\D'), '');
    if (digits.length < 7) return 'Enter a valid phone number';
    return null;
  }

  static String? positiveNumber(String? value, {String field = 'Value'}) {
    if (value == null || value.trim().isEmpty) return null;
    final n = num.tryParse(value.trim());
    if (n == null) return '$field must be a number';
    if (n < 0) return '$field must be ≥ 0';
    return null;
  }
}
