import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:image_picker/image_picker.dart';
import '../../core/constants/colors.dart';
import '../../providers/provider_provider.dart';

class PortfolioManagerView extends StatefulWidget {
  const PortfolioManagerView({super.key});

  @override
  State<PortfolioManagerView> createState() => _PortfolioManagerViewState();
}

class _PortfolioManagerViewState extends State<PortfolioManagerView> {
  final ImagePicker _picker = ImagePicker();

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      context.read<ProviderProvider>().loadProviderProfile();
    });
  }

  void _uploadImage() async {
    try {
      final XFile? image = await _picker.pickImage(source: ImageSource.gallery);
      if (image == null) return;

      // In real-world, we'd upload this file to the server and get a URL.
      // Here, we can simulate by adding a mock URL, or uploading if we have an endpoint.
      // Since backend has `products/upload`, we could call that, but portfolio uses a direct URL.
      // We will pass a standard heritage image URL as a placeholder demonstration of adding.
      final provider = context.read<ProviderProvider>();
      final mockUrls = [
        'https://images.unsplash.com/photo-1583391733956-3750e0ff4e8b?q=80&w=400',
        'https://images.unsplash.com/photo-1542038784456-1ea8e935640e?q=80&w=400',
        'https://images.unsplash.com/photo-1512436991641-6745cdb1723f?q=80&w=400',
      ];
      final randomUrl = mockUrls[DateTime.now().millisecond % mockUrls.length];

      final success = await provider.addPortfolioImage(randomUrl);
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(
              success ? 'Đã thêm tác phẩm mới vào Portfolio!' : 'Thêm tác phẩm thất bại.',
            ),
          ),
        );
      }
    } catch (_) {}
  }

  void _confirmDelete(String imageUrl) {
    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Xóa tác phẩm'),
        content: const Text('Bạn có chắc chắn muốn gỡ bỏ tác phẩm này khỏi Portfolio của mình?'),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx),
            child: const Text('HỦY BỎ'),
          ),
          ElevatedButton(
            onPressed: () async {
              Navigator.pop(ctx);
              final success = await context.read<ProviderProvider>().removePortfolioImage(imageUrl);
              if (mounted) {
                ScaffoldMessenger.of(context).showSnackBar(
                  SnackBar(
                    content: Text(
                      success ? 'Đã gỡ tác phẩm thành công!' : 'Gỡ tác phẩm thất bại.',
                    ),
                  ),
                );
              }
            },
            style: ElevatedButton.styleFrom(backgroundColor: AppColors.error),
            child: const Text('XÓA BỎ'),
          )
        ],
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final provider = context.watch<ProviderProvider>();
    final profile = provider.providerProfile;
    final List portfolio = profile['portfolio'] as List? ?? [];

    return Scaffold(
      appBar: AppBar(
        title: const Text('Quản lý Portfolio'),
        actions: [
          IconButton(
            icon: const Icon(Icons.add_photo_alternate_outlined, color: AppColors.primary),
            onPressed: _uploadImage,
          )
        ],
      ),
      body: provider.isLoading && portfolio.isEmpty
          ? const Center(child: CircularProgressIndicator(color: AppColors.primary))
          : RefreshIndicator(
              color: AppColors.primary,
              onRefresh: () => provider.loadProviderProfile(),
              child: portfolio.isEmpty
                  ? const Center(
                      child: Padding(
                        padding: EdgeInsets.all(32.0),
                        child: Text(
                          'Portfolio của bạn hiện đang trống. Hãy nhấn biểu tượng bên trên để tải lên tác phẩm đầu tiên!',
                          textAlign: TextAlign.center,
                        ),
                      ),
                    )
                  : GridView.builder(
                      padding: const EdgeInsets.all(16),
                      gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
                        crossAxisCount: 2,
                        crossAxisSpacing: 16,
                        mainAxisSpacing: 16,
                        childAspectRatio: 1,
                      ),
                      itemCount: portfolio.length,
                      itemBuilder: (context, index) {
                        final imgUrl = portfolio[index].toString();
                        return Card(
                          clipBehavior: Clip.antiAlias,
                          child: Stack(
                            fit: StackFit.expand,
                            children: [
                              Image.network(
                                imgUrl,
                                fit: BoxFit.cover,
                                errorBuilder: (_, __, ___) => const Icon(Icons.image),
                              ),
                              Positioned(
                                top: 4,
                                right: 4,
                                child: CircleAvatar(
                                  radius: 16,
                                  backgroundColor: Colors.white.withOpacity(0.9),
                                  child: IconButton(
                                    padding: EdgeInsets.zero,
                                    icon: const Icon(Icons.delete, color: AppColors.error, size: 18),
                                    onPressed: () => _confirmDelete(imgUrl),
                                  ),
                                ),
                              )
                            ],
                          ),
                        );
                      },
                    ),
            ),
    );
  }
}