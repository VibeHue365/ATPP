import 'package:flutter/material.dart';
import 'package:url_launcher/url_launcher.dart';
import 'package:flutter_map/flutter_map.dart';
import 'package:latlong2/latlong.dart';
import '../../core/constants/colors.dart';

class MapView extends StatefulWidget {
  const MapView({super.key});

  @override
  State<MapView> createState() => _MapViewState();
}

class _MapViewState extends State<MapView> {
  int _selectedStoreIndex = 0;
  final MapController _mapController = MapController();

  final List<Map<String, dynamic>> _stores = [
    {
      'name': 'VibeHue Tràng An',
      'address': '123 Phố Huế, Q. Hai Bà Trưng, Hà Nội',
      'phone': '0988 777 666',
      'hours': '08:00 - 21:00 (Hàng ngày)',
      'latitude': 21.018151,
      'longitude': 105.851961,
      'icon': Icons.account_balance,
      'description': 'Showroom trang phục lớn nhất miền Bắc, hơn 200 bộ áo dài cổ phong cao cấp.'
    },
    {
      'name': 'VibeHue Cố Đô',
      'address': '45 Lê Lợi, P. Phú Hội, TP. Huế',
      'phone': '0977 888 999',
      'hours': '07:30 - 22:00 (Hàng ngày)',
      'latitude': 16.467472,
      'longitude': 107.590528,
      'icon': Icons.castle,
      'description': 'Nằm cạnh dòng Sông Hương thơ mộng, cung cấp dịch vụ thuê đồ chụp ảnh ngoại cảnh Cố Đô.'
    }
  ];

  Future<void> _openMap(double lat, double lng, String name) async {
    final googleMapsUrl = Uri.parse("https://www.google.com/maps/search/?api=1&query=$lat,$lng");
    final appleMapsUrl = Uri.parse("https://maps.apple.com/?q=$name&ll=$lat,$lng");

    try {
      if (await canLaunchUrl(googleMapsUrl)) {
        await launchUrl(googleMapsUrl, mode: LaunchMode.externalApplication);
      } else if (await canLaunchUrl(appleMapsUrl)) {
        await launchUrl(appleMapsUrl, mode: LaunchMode.externalApplication);
      } else {
        throw 'Could not launch map application';
      }
    } catch (e) {
      if (mounted) {
        showDialog(
          context: context,
          builder: (ctx) => AlertDialog(
            title: const Text('Mở bản đồ thất bại'),
            content: Text('Quý khách vui lòng truy cập Google Maps và tìm kiếm địa chỉ:\n\n${_stores[_selectedStoreIndex]['address']}'),
            actions: [
              TextButton(
                onPressed: () => Navigator.pop(ctx),
                child: const Text('ĐỒNG Ý'),
              ),
            ],
          ),
        );
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final selectedStore = _stores[_selectedStoreIndex];

    return Scaffold(
      appBar: AppBar(
        title: const Text('Hệ thống Cửa Hàng'),
      ),
      body: Column(
        children: [
          // Stylized Interactive Vector Map Mockup
          Expanded(
            flex: 5,
            child: Container(
              margin: const EdgeInsets.all(16),
              decoration: BoxDecoration(
                color: AppColors.primaryTrans.withOpacity(0.05),
                borderRadius: BorderRadius.circular(20),
                border: Border.all(color: AppColors.gold.withOpacity(0.3), width: 1.5),
              ),
              child: ClipRRect(
                borderRadius: BorderRadius.circular(18),
                child: Stack(
                  children: [
                    FlutterMap(
                      mapController: _mapController,
                      options: MapOptions(
                        initialCenter: LatLng(selectedStore['latitude'], selectedStore['longitude']),
                        initialZoom: 15.0,
                        minZoom: 4.0,
                        maxZoom: 18.0,
                      ),
                      children: [
                        TileLayer(
                          urlTemplate: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
                          userAgentPackageName: 'com.vibehue.mobile',
                        ),
                        MarkerLayer(
                          markers: _stores.asMap().entries.map((entry) {
                            final index = entry.key;
                            final store = entry.value;
                            final isSelected = index == _selectedStoreIndex;
                            return Marker(
                              point: LatLng(store['latitude'], store['longitude']),
                              width: 120.0,
                              height: 80.0,
                              child: GestureDetector(
                                onTap: () {
                                  setState(() {
                                    _selectedStoreIndex = index;
                                  });
                                  _mapController.move(
                                    LatLng(store['latitude'], store['longitude']),
                                    15.0,
                                  );
                                },
                                child: Column(
                                  mainAxisSize: MainAxisSize.min,
                                  children: [
                                    AnimatedContainer(
                                      duration: const Duration(milliseconds: 200),
                                      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                                      decoration: BoxDecoration(
                                        color: isSelected ? AppColors.primary : Colors.white,
                                        borderRadius: BorderRadius.circular(8),
                                        border: Border.all(
                                          color: isSelected ? AppColors.gold : Colors.grey.shade400,
                                          width: 1.5,
                                        ),
                                        boxShadow: [
                                          BoxShadow(
                                            color: Colors.black.withOpacity(0.15),
                                            blurRadius: 6,
                                            offset: const Offset(0, 3),
                                          )
                                        ],
                                      ),
                                      child: Text(
                                        store['name'].toString().replaceFirst('VibeHue ', ''),
                                        style: TextStyle(
                                          fontSize: 10,
                                          fontWeight: FontWeight.bold,
                                          color: isSelected ? Colors.white : AppColors.textSecondary,
                                        ),
                                      ),
                                    ),
                                    const SizedBox(height: 2),
                                    Icon(
                                      Icons.location_on,
                                      color: isSelected ? AppColors.primary : Colors.grey.shade600,
                                      size: isSelected ? 36.0 : 28.0,
                                      shadows: [
                                        Shadow(
                                          color: Colors.black.withOpacity(0.2),
                                          offset: const Offset(0, 2),
                                          blurRadius: 4,
                                        )
                                      ],
                                    ),
                                  ],
                                ),
                              ),
                            );
                          }).toList(),
                        ),
                      ],
                    ),
                    // Floating instructions
                    Positioned(
                      top: 12,
                      left: 12,
                      child: Container(
                        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                        decoration: BoxDecoration(
                          color: Colors.white.withOpacity(0.85),
                          borderRadius: BorderRadius.circular(20),
                          border: Border.all(color: AppColors.gold, width: 0.8),
                        ),
                        child: const Row(
                          children: [
                            Icon(Icons.touch_app, size: 14, color: AppColors.primary),
                            SizedBox(width: 4),
                            Text(
                              'Nhấp ghim vị trí để chuyển tiệm',
                              style: TextStyle(fontSize: 10, fontWeight: FontWeight.bold, color: AppColors.primaryDark),
                            ),
                          ],
                        ),
                      ),
                    ),
                  ],
                ),
              ),
            ),
          ),

          // Store selection cards
          Expanded(
            flex: 4,
            child: SingleChildScrollView(
              padding: const EdgeInsets.symmetric(horizontal: 16.0),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  // Store selector tab row
                  Row(
                    children: List.generate(_stores.length, (index) {
                      final isSelected = _selectedStoreIndex == index;
                      return Expanded(
                        child: Padding(
                          padding: EdgeInsets.only(
                            right: index == 0 ? 8.0 : 0.0,
                            left: index == 1 ? 8.0 : 0.0,
                          ),
                          child: InkWell(
                            onTap: () {
                              setState(() {
                                _selectedStoreIndex = index;
                              });
                              _mapController.move(
                                LatLng(_stores[index]['latitude'], _stores[index]['longitude']),
                                15.0,
                              );
                            },
                            child: AnimatedContainer(
                              duration: const Duration(milliseconds: 250),
                              padding: const EdgeInsets.symmetric(vertical: 12),
                              decoration: BoxDecoration(
                                color: isSelected ? AppColors.primary : Colors.white,
                                borderRadius: BorderRadius.circular(10),
                                border: Border.all(
                                  color: isSelected ? AppColors.primary : AppColors.textSecondary.withOpacity(0.2),
                                  width: 1.5,
                                ),
                              ),
                              child: Text(
                                _stores[index]['name'],
                                textAlign: TextAlign.center,
                                style: TextStyle(
                                  fontWeight: FontWeight.bold,
                                  color: isSelected ? Colors.white : AppColors.textSecondary,
                                ),
                              ),
                            ),
                          ),
                        ),
                      );
                    }),
                  ),
                  const SizedBox(height: 16),

                  // Active Store Details Card
                  Card(
                    child: Padding(
                      padding: const EdgeInsets.all(16.0),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Row(
                            children: [
                              Icon(selectedStore['icon'], color: AppColors.gold, size: 24),
                              const SizedBox(width: 8),
                              Text(
                                selectedStore['name'],
                                style: theme.textTheme.titleMedium?.copyWith(fontWeight: FontWeight.bold),
                              ),
                            ],
                          ),
                          const SizedBox(height: 12),
                          Text(
                            selectedStore['description'],
                            style: const TextStyle(fontSize: 13, color: AppColors.textSecondary, fontStyle: FontStyle.italic),
                          ),
                          const Divider(height: 24),
                          Row(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              const Icon(Icons.location_on, color: AppColors.primary, size: 18),
                              const SizedBox(width: 8),
                              Expanded(
                                child: Text(
                                  selectedStore['address'],
                                  style: const TextStyle(fontSize: 13, height: 1.4),
                                ),
                              ),
                            ],
                          ),
                          const SizedBox(height: 8),
                          Row(
                            children: [
                              const Icon(Icons.phone, color: AppColors.primary, size: 18),
                              const SizedBox(width: 8),
                              Text(selectedStore['phone'], style: const TextStyle(fontSize: 13)),
                            ],
                          ),
                          const SizedBox(height: 8),
                          Row(
                            children: [
                              const Icon(Icons.access_time, color: AppColors.primary, size: 18),
                              const SizedBox(width: 8),
                              Text(selectedStore['hours'], style: const TextStyle(fontSize: 13)),
                            ],
                          ),
                          const SizedBox(height: 16),
                          ElevatedButton.icon(
                            onPressed: () => _openMap(
                              selectedStore['latitude'],
                              selectedStore['longitude'],
                              selectedStore['name'],
                            ),
                            style: ElevatedButton.styleFrom(
                              minimumSize: const Size.fromHeight(45),
                            ),
                            icon: const Icon(Icons.navigation_outlined),
                            label: const Text('CHỈ ĐƯỜNG TRÊN BẢN ĐỒ'),
                          ),
                        ],
                      ),
                    ),
                  ),
                  const SizedBox(height: 16),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }
}


