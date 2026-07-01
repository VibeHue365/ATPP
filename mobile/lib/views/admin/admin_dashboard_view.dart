import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../core/constants/colors.dart';
import '../../providers/auth_provider.dart';
import '../../services/admin_service.dart';
import '../onboarding/onboarding_view.dart';

class AdminDashboardView extends StatefulWidget {
  const AdminDashboardView({super.key});

  @override
  State<AdminDashboardView> createState() => _AdminDashboardViewState();
}

class _AdminDashboardViewState extends State<AdminDashboardView> {
  int _currentIndex = 0;

  final List<Widget> _tabs = [
    const AdminStatsTab(),
    const AdminCustomersTab(),
    const AdminProvidersTab(),
  ];

  @override
  Widget build(BuildContext context) {
    final auth = context.watch<AuthProvider>();

    return Scaffold(
      appBar: AppBar(
        title: const Text(
          'Kênh Quản trị Admin',
          style: TextStyle(
            fontFamily: 'Playfair Display',
            fontWeight: FontWeight.bold,
            fontSize: 20,
          ),
        ),
        actions: [
          IconButton(
            icon: const Icon(Icons.logout, color: AppColors.error),
            onPressed: () async {
              await auth.logout();
              if (context.mounted) {
                Navigator.pushAndRemoveUntil(
                  context,
                  MaterialPageRoute(builder: (_) => const OnboardingView()),
                  (route) => false,
                );
              }
            },
          ),
        ],
      ),
      body: IndexedStack(
        index: _currentIndex,
        children: _tabs,
      ),
      bottomNavigationBar: BottomNavigationBar(
        currentIndex: _currentIndex,
        selectedItemColor: AppColors.primary,
        unselectedItemColor: AppColors.textSecondary.withOpacity(0.6),
        type: BottomNavigationBarType.fixed,
        backgroundColor: Colors.white,
        elevation: 8,
        onTap: (index) {
          setState(() {
            _currentIndex = index;
          });
        },
        items: const [
          BottomNavigationBarItem(
            icon: Icon(Icons.analytics_outlined),
            activeIcon: Icon(Icons.analytics),
            label: 'Thống kê',
          ),
          BottomNavigationBarItem(
            icon: Icon(Icons.people_outline),
            activeIcon: Icon(Icons.people),
            label: 'Khách hàng',
          ),
          BottomNavigationBarItem(
            icon: Icon(Icons.storefront_outlined),
            activeIcon: Icon(Icons.storefront),
            label: 'Đối tác',
          ),
        ],
      ),
    );
  }
}

// ──────────────────────────────────────────────────────────────────────────────
// TAB 1: THỐNG KÊ DOANH THU & HỆ THỐNG
// ──────────────────────────────────────────────────────────────────────────────
class AdminStatsTab extends StatefulWidget {
  const AdminStatsTab({super.key});

  @override
  State<AdminStatsTab> createState() => _AdminStatsTabState();
}

class _AdminStatsTabState extends State<AdminStatsTab> {
  final AdminService _adminService = AdminService();
  AdminStats? _stats;
  bool _isLoading = false;

  @override
  void initState() {
    super.initState();
    _loadStats();
  }

  Future<void> _loadStats() async {
    setState(() {
      _isLoading = true;
    });
    try {
      final data = await _adminService.getStats();
      setState(() {
        _stats = data;
      });
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text(e.toString()), backgroundColor: AppColors.error),
        );
      }
    } finally {
      setState(() {
        _isLoading = false;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    if (_isLoading && _stats == null) {
      return const Center(child: CircularProgressIndicator(color: AppColors.primary));
    }

    final stats = _stats;
    final double revenue = stats?.totalRevenue ?? 0.0;
    final String formattedRevenue = revenue.toStringAsFixed(0).replaceAllMapped(
          RegExp(r'(\d{1,3})(?=(\d{3})+(?!\d))'),
          (Match m) => '${m[1]},',
        );

    return RefreshIndicator(
      color: AppColors.primary,
      onRefresh: _loadStats,
      child: SingleChildScrollView(
        physics: const AlwaysScrollableScrollPhysics(),
        padding: const EdgeInsets.all(16.0),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            const Text(
              'Tổng quan hệ thống',
              style: TextStyle(fontSize: 22, fontWeight: FontWeight.bold, color: AppColors.primaryDark),
            ),
            const SizedBox(height: 4),
            const Text('Báo cáo doanh số và tài khoản trên toàn nền tảng Di Sản Áo Dài.'),
            const SizedBox(height: 20),

            // Giant Revenue Card
            Container(
              decoration: BoxDecoration(
                gradient: const LinearGradient(
                  colors: [AppColors.primary, AppColors.primaryDark],
                  begin: Alignment.topLeft,
                  end: Alignment.bottomRight,
                ),
                borderRadius: BorderRadius.circular(16),
                boxShadow: [
                  BoxShadow(
                    color: AppColors.primary.withOpacity(0.3),
                    blurRadius: 10,
                    offset: const Offset(0, 4),
                  ),
                ],
              ),
              padding: const EdgeInsets.all(24.0),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: const [
                      Text(
                        'TỔNG DOANH THU NỀN TẢNG',
                        style: TextStyle(
                          fontSize: 12,
                          fontWeight: FontWeight.bold,
                          color: Colors.white70,
                          letterSpacing: 1.2,
                        ),
                      ),
                      Icon(Icons.monetization_on, color: AppColors.gold, size: 28),
                    ],
                  ),
                  const SizedBox(height: 12),
                  Text(
                    '$formattedRevenueđ',
                    style: const TextStyle(
                      fontSize: 32,
                      fontWeight: FontWeight.bold,
                      color: Colors.white,
                      fontFamily: 'Playfair Display',
                    ),
                  ),
                  const SizedBox(height: 6),
                  const Text(
                    'Đã bao gồm cọc & các dịch vụ đã hoàn thành',
                    style: TextStyle(fontSize: 11, color: Colors.white60, fontStyle: FontStyle.italic),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 20),

            // 3 Small Metric Cards Grid
            GridView.count(
              crossAxisCount: 2,
              crossAxisSpacing: 12,
              mainAxisSpacing: 12,
              shrinkWrap: true,
              physics: const NeverScrollableScrollPhysics(),
              childAspectRatio: 1.35,
              children: [
                _buildMetricCard(
                  'Tổng khách hàng',
                  '${stats?.totalCustomers ?? 0} thành viên',
                  Icons.people,
                  Colors.blue,
                ),
                _buildMetricCard(
                  'Tổng đối tác',
                  '${stats?.totalProviders ?? 0} đối tác',
                  Icons.storefront,
                  Colors.teal,
                ),
                _buildMetricCard(
                  'Tổng đơn đặt lịch',
                  '${stats?.totalBookings ?? 0} giao dịch',
                  Icons.receipt_long,
                  Colors.deepOrange,
                ),
                _buildMetricCard(
                  'Chất lượng dịch vụ',
                  'Khợp lệnh 100%',
                  Icons.verified_user,
                  Colors.green,
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildMetricCard(String title, String value, IconData icon, Color color) {
    return Card(
      elevation: 2,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(12),
        side: BorderSide(color: Colors.grey.shade200, width: 1),
      ),
      child: Padding(
        padding: const EdgeInsets.all(16.0),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            CircleAvatar(
              backgroundColor: color.withOpacity(0.1),
              radius: 18,
              child: Icon(icon, color: color, size: 20),
            ),
            const SizedBox(height: 12),
            Text(
              title,
              style: const TextStyle(fontSize: 11, color: AppColors.textSecondary, fontWeight: FontWeight.bold),
            ),
            const SizedBox(height: 4),
            Text(
              value,
              style: const TextStyle(fontSize: 14, fontWeight: FontWeight.bold, color: AppColors.textPrimary),
            ),
          ],
        ),
      ),
    );
  }
}

// ──────────────────────────────────────────────────────────────────────────────
// TAB 2: QUẢN LÝ KHÁCH HÀNG (CÓ BAN/UNBAN)
// ──────────────────────────────────────────────────────────────────────────────
class AdminCustomersTab extends StatefulWidget {
  const AdminCustomersTab({super.key});

  @override
  State<AdminCustomersTab> createState() => _AdminCustomersTabState();
}

class _AdminCustomersTabState extends State<AdminCustomersTab> {
  final AdminService _adminService = AdminService();
  List<AdminCustomer> _customers = [];
  List<AdminCustomer> _filteredCustomers = [];
  bool _isLoading = false;
  final TextEditingController _searchController = TextEditingController();

  @override
  void initState() {
    super.initState();
    _loadCustomers();
    _searchController.addListener(_onSearchChanged);
  }

  @override
  void dispose() {
    _searchController.dispose();
    super.dispose();
  }

  Future<void> _loadCustomers() async {
    setState(() {
      _isLoading = true;
    });
    try {
      final data = await _adminService.getCustomers();
      setState(() {
        _customers = data;
        _filteredCustomers = data;
      });
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text(e.toString()), backgroundColor: AppColors.error),
        );
      }
    } finally {
      setState(() {
        _isLoading = false;
      });
    }
  }

  void _onSearchChanged() {
    final query = _searchController.text.toLowerCase();
    setState(() {
      _filteredCustomers = _customers.where((c) {
        return c.fullName.toLowerCase().contains(query) || c.email.toLowerCase().contains(query);
      }).toList();
    });
  }

  void _toggleBanCustomer(AdminCustomer customer) {
    final isBanned = customer.accountStatus == 'BANNED';
    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        title: Text(isBanned ? 'Mở khóa khách hàng' : 'Khóa tài khoản khách hàng'),
        content: Text(
          isBanned
              ? 'Bạn có chắc chắn muốn mở khóa cho tài khoản ${customer.fullName} không?'
              : 'Bạn có chắc chắn muốn khóa tài khoản ${customer.fullName} không? Người dùng bị khóa sẽ không thể đăng nhập vào ứng dụng.',
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx),
            child: const Text('HỦY'),
          ),
          ElevatedButton(
            onPressed: () async {
              Navigator.pop(ctx);
              try {
                if (isBanned) {
                  await _adminService.unbanCustomer(customer.id);
                } else {
                  await _adminService.banCustomer(customer.id);
                }
                _loadCustomers();
                if (mounted) {
                  ScaffoldMessenger.of(context).showSnackBar(
                    SnackBar(
                      content: Text(isBanned ? 'Đã mở khóa tài khoản!' : 'Đã khóa tài khoản thành công!'),
                      backgroundColor: isBanned ? Colors.green : AppColors.error,
                    ),
                  );
                }
              } catch (e) {
                if (mounted) {
                  ScaffoldMessenger.of(context).showSnackBar(
                    SnackBar(content: Text(e.toString()), backgroundColor: AppColors.error),
                  );
                }
              }
            },
            style: ElevatedButton.styleFrom(
              backgroundColor: isBanned ? Colors.green : AppColors.error,
            ),
            child: Text(isBanned ? 'MỞ KHÓA' : 'KHÓA'),
          ),
        ],
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        // Search bar
        Padding(
          padding: const EdgeInsets.all(16.0),
          child: TextField(
            controller: _searchController,
            decoration: InputDecoration(
              hintText: 'Tìm kiếm khách hàng theo tên, email...',
              prefixIcon: const Icon(Icons.search, color: AppColors.primary),
              suffixIcon: _searchController.text.isNotEmpty
                  ? IconButton(
                      icon: const Icon(Icons.clear),
                      onPressed: () => _searchController.clear(),
                    )
                  : null,
              border: OutlineInputBorder(
                borderRadius: BorderRadius.circular(12),
                borderSide: BorderSide(color: Colors.grey.shade300),
              ),
              contentPadding: const EdgeInsets.symmetric(vertical: 0),
            ),
          ),
        ),

        // List
        Expanded(
          child: RefreshIndicator(
            color: AppColors.primary,
            onRefresh: _loadCustomers,
            child: _isLoading && _customers.isEmpty
                ? const Center(child: CircularProgressIndicator(color: AppColors.primary))
                : _filteredCustomers.isEmpty
                    ? ListView(
                        children: const [
                          Padding(
                            padding: EdgeInsets.all(40.0),
                            child: Center(
                              child: Text(
                                'Không tìm thấy khách hàng nào.',
                                style: TextStyle(color: AppColors.textSecondary),
                              ),
                            ),
                          ),
                        ],
                      )
                    : ListView.builder(
                        padding: const EdgeInsets.symmetric(horizontal: 16),
                        itemCount: _filteredCustomers.length,
                        itemBuilder: (context, index) {
                          final customer = _filteredCustomers[index];
                          final isBanned = customer.accountStatus == 'BANNED';
                          final String initials = customer.fullName.isNotEmpty
                              ? customer.fullName.trim().split(' ').last[0].toUpperCase()
                              : 'K';
                          return Card(
                            margin: const EdgeInsets.only(bottom: 12),
                            elevation: 1.5,
                            shape: RoundedRectangleBorder(
                              borderRadius: BorderRadius.circular(10),
                            ),
                            child: ListTile(
                              onTap: () => _toggleBanCustomer(customer),
                              leading: CircleAvatar(
                                backgroundColor: AppColors.primaryTrans,
                                backgroundImage: customer.avatarUrl.isNotEmpty
                                    ? NetworkImage(customer.avatarUrl)
                                    : null,
                                child: customer.avatarUrl.isEmpty
                                    ? Text(
                                        initials,
                                        style: const TextStyle(fontWeight: FontWeight.bold, color: AppColors.primary),
                                      )
                                    : null,
                              ),
                              title: Text(
                                customer.fullName,
                                style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 14),
                              ),
                              subtitle: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  const SizedBox(height: 2),
                                  Text('Email: ${customer.email}', style: const TextStyle(fontSize: 12)),
                                  if (customer.phone.isNotEmpty) ...[
                                    const SizedBox(height: 2),
                                    Text('SĐT: ${customer.phone}', style: const TextStyle(fontSize: 12)),
                                  ],
                                  const SizedBox(height: 2),
                                  Text('Giới tính: ${customer.gender}', style: const TextStyle(fontSize: 12)),
                                ],
                              ),
                              trailing: Container(
                                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                                decoration: BoxDecoration(
                                  color: isBanned ? Colors.red.shade50 : Colors.green.shade50,
                                  borderRadius: BorderRadius.circular(6),
                                ),
                                child: Text(
                                  customer.accountStatus,
                                  style: TextStyle(
                                    fontSize: 10,
                                    fontWeight: FontWeight.bold,
                                    color: isBanned ? Colors.red.shade700 : Colors.green.shade700,
                                  ),
                                ),
                              ),
                            ),
                          );
                        },
                      ),
          ),
        ),
      ],
    );
  }
}

// ──────────────────────────────────────────────────────────────────────────────
// TAB 3: QUẢN LÝ PROVIDER (ĐỐI TÁC - CÓ ĐÌNH CHỈ / KHÔI PHỤC)
// ──────────────────────────────────────────────────────────────────────────────
class AdminProvidersTab extends StatefulWidget {
  const AdminProvidersTab({super.key});

  @override
  State<AdminProvidersTab> createState() => _AdminProvidersTabState();
}

class _AdminProvidersTabState extends State<AdminProvidersTab> {
  final AdminService _adminService = AdminService();
  List<AdminProviderModel> _providers = [];
  List<AdminProviderModel> _filteredProviders = [];
  bool _isLoading = false;
  final TextEditingController _searchController = TextEditingController();

  @override
  void initState() {
    super.initState();
    _loadProviders();
    _searchController.addListener(_onSearchChanged);
  }

  @override
  void dispose() {
    _searchController.dispose();
    super.dispose();
  }

  Future<void> _loadProviders() async {
    setState(() {
      _isLoading = true;
    });
    try {
      final data = await _adminService.getProviders();
      setState(() {
        _providers = data;
        _filteredProviders = data;
      });
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text(e.toString()), backgroundColor: AppColors.error),
        );
      }
    } finally {
      setState(() {
        _isLoading = false;
      });
    }
  }

  void _onSearchChanged() {
    final query = _searchController.text.toLowerCase();
    setState(() {
      _filteredProviders = _providers.where((p) {
        return p.businessName.toLowerCase().contains(query) || p.city.toLowerCase().contains(query);
      }).toList();
    });
  }

  void _toggleSuspendProvider(AdminProviderModel provider) {
    final isSuspended = provider.status == 'SUSPENDED';
    final reasonController = TextEditingController();

    if (isSuspended) {
      // Unsuspension dialog
      showDialog(
        context: context,
        builder: (ctx) => AlertDialog(
          title: const Text('Khôi phục hoạt động đối tác'),
          content: Text('Bạn có chắc chắn muốn mở khóa hoạt động cho "${provider.businessName}" không?'),
          actions: [
            TextButton(
              onPressed: () => Navigator.pop(ctx),
              child: const Text('HỦY'),
            ),
            ElevatedButton(
              onPressed: () async {
                Navigator.pop(ctx);
                try {
                  await _adminService.unsuspendProvider(provider.id);
                  _loadProviders();
                  if (mounted) {
                    ScaffoldMessenger.of(context).showSnackBar(
                      const SnackBar(
                        content: Text('Đã khôi phục hoạt động đối tác thành công!'),
                        backgroundColor: Colors.green,
                      ),
                    );
                  }
                } catch (e) {
                  if (mounted) {
                    ScaffoldMessenger.of(context).showSnackBar(
                      SnackBar(content: Text(e.toString()), backgroundColor: AppColors.error),
                    );
                  }
                }
              },
              style: ElevatedButton.styleFrom(backgroundColor: Colors.green),
              child: const Text('KHÔI PHỤC'),
            ),
          ],
        ),
      );
    } else {
      // Suspension dialog
      showDialog(
        context: context,
        builder: (ctx) => AlertDialog(
          title: const Text('Đình chỉ đối tác'),
          content: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Text('Bạn có chắc muốn đình chỉ hoạt động của "${provider.businessName}"?'),
              const SizedBox(height: 12),
              TextField(
                controller: reasonController,
                decoration: const InputDecoration(
                  labelText: 'Lý do đình chỉ (bắt buộc)',
                  border: OutlineInputBorder(),
                ),
              ),
            ],
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.pop(ctx),
              child: const Text('HỦY'),
            ),
            ElevatedButton(
              onPressed: () async {
                final reason = reasonController.text.trim();
                if (reason.isEmpty) {
                  ScaffoldMessenger.of(context).showSnackBar(
                    const SnackBar(content: Text('Vui lòng nhập lý do đình chỉ!'), backgroundColor: AppColors.error),
                  );
                  return;
                }
                Navigator.pop(ctx);
                try {
                  await _adminService.suspendProvider(provider.id, reason);
                  _loadProviders();
                  if (mounted) {
                    ScaffoldMessenger.of(context).showSnackBar(
                      const SnackBar(
                        content: Text('Đã đình chỉ đối tác thành công!'),
                        backgroundColor: AppColors.error,
                      ),
                    );
                  }
                } catch (e) {
                  if (mounted) {
                    ScaffoldMessenger.of(context).showSnackBar(
                      SnackBar(content: Text(e.toString()), backgroundColor: AppColors.error),
                    );
                  }
                }
              },
              style: ElevatedButton.styleFrom(backgroundColor: AppColors.error),
              child: const Text('ĐÌNH CHỈ'),
            ),
          ],
        ),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        // Search bar
        Padding(
          padding: const EdgeInsets.all(16.0),
          child: TextField(
            controller: _searchController,
            decoration: InputDecoration(
              hintText: 'Tìm kiếm đối tác theo tên, thành phố...',
              prefixIcon: const Icon(Icons.search, color: AppColors.primary),
              suffixIcon: _searchController.text.isNotEmpty
                  ? IconButton(
                      icon: const Icon(Icons.clear),
                      onPressed: () => _searchController.clear(),
                    )
                  : null,
              border: OutlineInputBorder(
                borderRadius: BorderRadius.circular(12),
                borderSide: BorderSide(color: Colors.grey.shade300),
              ),
              contentPadding: const EdgeInsets.symmetric(vertical: 0),
            ),
          ),
        ),

        // List
        Expanded(
          child: RefreshIndicator(
            color: AppColors.primary,
            onRefresh: _loadProviders,
            child: _isLoading && _providers.isEmpty
                ? const Center(child: CircularProgressIndicator(color: AppColors.primary))
                : _filteredProviders.isEmpty
                    ? ListView(
                        children: const [
                          Padding(
                            padding: EdgeInsets.all(40.0),
                            child: Center(
                              child: Text(
                                'Không tìm thấy đối tác nào.',
                                style: TextStyle(color: AppColors.textSecondary),
                              ),
                            ),
                          ),
                        ],
                      )
                    : ListView.builder(
                        padding: const EdgeInsets.symmetric(horizontal: 16),
                        itemCount: _filteredProviders.length,
                        itemBuilder: (context, index) {
                          final provider = _filteredProviders[index];
                          final isSuspended = provider.status == 'SUSPENDED';
                          return Card(
                            margin: const EdgeInsets.only(bottom: 12),
                            elevation: 1.5,
                            shape: RoundedRectangleBorder(
                              borderRadius: BorderRadius.circular(10),
                            ),
                            child: InkWell(
                              onTap: () => _toggleSuspendProvider(provider),
                              borderRadius: BorderRadius.circular(10),
                              child: Padding(
                                padding: const EdgeInsets.all(14.0),
                                child: Column(
                                  crossAxisAlignment: CrossAxisAlignment.start,
                                  children: [
                                    Row(
                                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                                      children: [
                                        Expanded(
                                          child: Text(
                                            provider.businessName,
                                            style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 14),
                                          ),
                                        ),
                                        Container(
                                          padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                                          decoration: BoxDecoration(
                                            color: provider.status == 'ACTIVE'
                                                ? Colors.green.shade50
                                                : (provider.status == 'PENDING_APPROVAL'
                                                    ? Colors.amber.shade50
                                                    : Colors.red.shade50),
                                            borderRadius: BorderRadius.circular(6),
                                          ),
                                          child: Text(
                                            provider.status,
                                            style: TextStyle(
                                              fontSize: 10,
                                              fontWeight: FontWeight.bold,
                                              color: provider.status == 'ACTIVE'
                                                  ? Colors.green.shade700
                                                  : (provider.status == 'PENDING_APPROVAL'
                                                      ? Colors.amber.shade700
                                                      : Colors.red.shade700),
                                            ),
                                          ),
                                        ),
                                      ],
                                    ),
                                    const SizedBox(height: 8),
                                    Text('Email: ${provider.email}', style: const TextStyle(fontSize: 12, color: AppColors.textSecondary)),
                                    const SizedBox(height: 2),
                                    Text('SĐT: ${provider.phone}', style: const TextStyle(fontSize: 12, color: AppColors.textSecondary)),
                                    const SizedBox(height: 2),
                                    Text('Địa chỉ: ${provider.addressLine}, ${provider.city}', style: const TextStyle(fontSize: 12, color: AppColors.textSecondary)),
                                  ],
                                ),
                              ),
                            ),
                          );
                        },
                      ),
          ),
        ),
      ],
    );
  }
}
