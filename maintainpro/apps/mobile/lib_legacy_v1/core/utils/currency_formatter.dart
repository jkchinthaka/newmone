import 'package:intl/intl.dart';

class CurrencyFormatter {
  CurrencyFormatter._();

  static final NumberFormat _currency = NumberFormat.simpleCurrency();
  static final NumberFormat _compact = NumberFormat.compactCurrency();
  static final NumberFormat _decimal = NumberFormat('#,##0.##');

  static String format(num? value) =>
      value == null ? '—' : _currency.format(value);

  static String compact(num? value) =>
      value == null ? '—' : _compact.format(value);

  static String number(num? value) =>
      value == null ? '—' : _decimal.format(value);

  static String percent(num? value, {int decimals = 1}) {
    if (value == null) return '—';
    return '${value.toStringAsFixed(decimals)}%';
  }
}
