import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';

import '../constants/app_colors.dart';
import '../constants/app_text_styles.dart';

enum AvatarSize { sm, md, lg, xl }

class AvatarWidget extends StatelessWidget {
  const AvatarWidget({
    super.key,
    this.imageUrl,
    this.name,
    this.size = AvatarSize.md,
    this.online,
    this.color,
  });

  final String? imageUrl;
  final String? name;
  final AvatarSize size;
  final bool? online;
  final Color? color;

  double get _diameter {
    switch (size) {
      case AvatarSize.sm:
        return 24;
      case AvatarSize.md:
        return 36;
      case AvatarSize.lg:
        return 48;
      case AvatarSize.xl:
        return 64;
    }
  }

  String get _initials {
    final parts = (name ?? '?').trim().split(RegExp(r'\s+'));
    if (parts.isEmpty || parts.first.isEmpty) return '?';
    if (parts.length == 1) return parts.first.substring(0, 1).toUpperCase();
    return (parts.first.substring(0, 1) + parts.last.substring(0, 1))
        .toUpperCase();
  }

  Color get _bg {
    if (color != null) return color!;
    final hash = (name ?? '?').hashCode;
    const palette = <Color>[
      AppColors.primary,
      AppColors.secondary,
      AppColors.info,
      AppColors.warning,
      AppColors.success,
    ];
    return palette[hash.abs() % palette.length];
  }

  @override
  Widget build(BuildContext context) {
    final d = _diameter;
    Widget avatar;
    if (imageUrl != null && imageUrl!.isNotEmpty) {
      avatar = ClipOval(
        child: CachedNetworkImage(
          imageUrl: imageUrl!,
          width: d,
          height: d,
          fit: BoxFit.cover,
          placeholder: (_, __) => _initialsCircle(d),
          errorWidget: (_, __, ___) => _initialsCircle(d),
        ),
      );
    } else {
      avatar = _initialsCircle(d);
    }

    if (online == null) return avatar;
    return Stack(
      clipBehavior: Clip.none,
      children: [
        avatar,
        Positioned(
          right: 0,
          bottom: 0,
          child: Container(
            width: d * 0.28,
            height: d * 0.28,
            decoration: BoxDecoration(
              color: online! ? AppColors.success : AppColors.textMuted,
              shape: BoxShape.circle,
              border: Border.all(color: AppColors.surface, width: 2),
            ),
          ),
        ),
      ],
    );
  }

  Widget _initialsCircle(double d) {
    return Container(
      width: d,
      height: d,
      alignment: Alignment.center,
      decoration: BoxDecoration(color: _bg, shape: BoxShape.circle),
      child: Text(
        _initials,
        style: AppTextStyles.subtitle.copyWith(
          color: Colors.white,
          fontSize: d * 0.4,
        ),
      ),
    );
  }
}
