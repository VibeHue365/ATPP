import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mobile/views/onboarding/onboarding_view.dart';

void main() {
  testWidgets('OnboardingView renders welcome elements and buttons', (WidgetTester tester) async {
    // Suppress network image loading exceptions because widget tests mock HTTP requests returning 400
    final originalOnError = FlutterError.onError;
    FlutterError.onError = (FlutterErrorDetails details) {
      if (details.exception is NetworkImageLoadException ||
          details.exception.toString().contains('NetworkImageLoadException') ||
          details.exception.toString().contains('HTTP request failed')) {
        return; // Ignore network image load failures
      }
      originalOnError?.call(details);
    };

    // Build OnboardingView wrapped in a MaterialApp
    await tester.pumpWidget(
      const MaterialApp(
        home: OnboardingView(),
      ),
    );

    // Verify that the title of first slide is rendered
    expect(find.text('Gìn Giữ Hồn Cốt Di Sản'), findsOneWidget);

    // Verify that the subtitle text is rendered
    expect(find.textContaining('tà áo ngũ thân'), findsOneWidget);

    // Verify that onboarding action buttons are NOT present initially
    expect(find.text('TÔI LÀ KHÁCH HÀNG'), findsNothing);
    expect(find.text('TÔI LÀ NHÀ CUNG CẤP / PHOTOGRAPHER'), findsNothing);

    // Verify the presence of brand icon on first page
    expect(find.byIcon(Icons.auto_stories), findsOneWidget);

    // Tap "TIẾP THEO" to navigate to second slide
    await tester.tap(find.text('TIẾP THEO'));
    await tester.pumpAndSettle();

    // Verify slide 2 title
    expect(find.text('Nhiếp Ảnh Chuyên Nghiệp'), findsOneWidget);

    // Tap "TIẾP THEO" again to navigate to final slide
    await tester.tap(find.text('TIẾP THEO'));
    await tester.pumpAndSettle();

    // Verify final slide title
    expect(find.text('Đặt Lịch Tự Động & An Toàn'), findsOneWidget);

    // Verify that onboarding buttons are now visible
    expect(find.text('TÔI LÀ KHÁCH HÀNG'), findsOneWidget);
    expect(find.text('TÔI LÀ NHÀ CUNG CẤP / PHOTOGRAPHER'), findsOneWidget);

    // Restore original error handler
    FlutterError.onError = originalOnError;
  });
}
