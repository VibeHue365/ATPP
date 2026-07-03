import 'dart:io';
import 'package:flutter/material.dart';
import 'package:image_picker/image_picker.dart';
import 'package:provider/provider.dart';
import '../../core/constants/colors.dart';
import '../../models/product.dart';
import '../../providers/provider_provider.dart';
import '../../services/api_service.dart';

class ProductFormView extends StatefulWidget {
  final Product? product;
  const ProductFormView({super.key, this.product});

  @override
  State<ProductFormView> createState() => _ProductFormViewState();
}

class _ProductFormViewState extends State<ProductFormView> {
  final _formKey = GlobalKey<FormState>();
  final _apiService = ApiService();

  late TextEditingController _nameController;
  late TextEditingController _priceController;
  late TextEditingController _depositController;
  late TextEditingController _descriptionController;

  String? _selectedCategoryId;
  List<CategoryItem> _categories = [];
  bool _isLoadingCategories = true;


  // Selected sizes
  final List<String> _allSizes = ['S', 'M', 'L', 'XL', 'XXL'];
  final List<String> _selectedSizes = [];

  // Selected colors
  final List<String> _allColors = ['WHITE', 'RED', 'GOLD', 'BLUE', 'PINK', 'GREEN'];
  final List<String> _selectedColors = [];

  // Images state
  final List<String> _existingImages = [];
  final List<String> _newLocalImagePaths = [];
  final ImagePicker _imagePicker = ImagePicker();

  @override
  void initState() {
    super.initState();
    _nameController = TextEditingController(text: widget.product?.name ?? '');
    _priceController = TextEditingController(
        text: widget.product?.price != null ? widget.product!.price.toStringAsFixed(0) : '');
    _depositController = TextEditingController(
        text: widget.product?.depositPrice != null ? widget.product!.depositPrice.toStringAsFixed(0) : '');
    _descriptionController = TextEditingController(text: widget.product?.description ?? '');

    if (widget.product != null) {
      if (widget.product!.imageUrl != null) {
        _existingImages.add(widget.product!.imageUrl!);
      }
      _selectedSizes.addAll(widget.product!.availableSizes);
      // Backend product structure might have colors, let's assume default color if empty
      _selectedColors.add('RED');
    } else {
      _selectedSizes.add('M');
      _selectedColors.add('RED');
    }

    _loadCategories();
  }

  @override
  void dispose() {
    _nameController.dispose();
    _priceController.dispose();
    _depositController.dispose();
    _descriptionController.dispose();
    super.dispose();
  }

  Future<void> _loadCategories() async {
    try {
      final list = await _apiService.getCategories();
      setState(() {
        _categories = list;
        if (list.isNotEmpty) {
          if (widget.product != null) {
            final match = list.firstWhere(
              (c) => c.id == widget.product!.categoryId || c.name == widget.product!.category,
              orElse: () => list.first,
            );
            _selectedCategoryId = match.id;
          } else {
            _selectedCategoryId = list.first.id;
          }
        }
        _isLoadingCategories = false;
      });
    } catch (_) {
      setState(() {
        _categories = [
          CategoryItem(id: '6a3820a623ebbf51f6dda4ce', name: 'Thuê Áo Dài'),
          CategoryItem(id: '6a3820a623ebbf51f6dda4cf', name: 'Gói Chụp Ảnh'),
        ];
        _selectedCategoryId = _categories.first.id;
        _isLoadingCategories = false;
      });
    }
  }


  Future<void> _pickImage() async {
    try {
      final XFile? image = await _imagePicker.pickImage(source: ImageSource.gallery);
      if (image != null) {
        setState(() {
          _newLocalImagePaths.add(image.path);
        });
      }
    } catch (e) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('Không thể chọn ảnh: $e')),
      );
    }
  }

  void _removeExistingImage(int index) {
    setState(() {
      _existingImages.removeAt(index);
    });
  }

  void _removeNewImage(int index) {
    setState(() {
      _newLocalImagePaths.removeAt(index);
    });
  }

  Future<void> _submit() async {
    if (!_formKey.currentState!.validate()) return;
    if (_existingImages.isEmpty && _newLocalImagePaths.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Vui lòng chọn ít nhất 1 ảnh cho sản phẩm!'), backgroundColor: Colors.red),
      );
      return;
    }

    final provider = context.read<ProviderProvider>();
    final Map<String, dynamic> productData = {
      'name': _nameController.text.trim(),
      'categoryId': _selectedCategoryId ?? '6a3820a623ebbf51f6dda4ce',
      'basePrice': double.parse(_priceController.text.trim()),

      'depositAmount': double.parse(_depositController.text.trim()),
      'description': _descriptionController.text.trim(),
      'sizes': _selectedSizes,
      'colors': _selectedColors,
      'status': 'ACTIVE',
    };

    bool success;
    if (widget.product == null) {
      success = await provider.addProduct(productData, _newLocalImagePaths);
    } else {
      success = await provider.editProduct(
        widget.product!.id,
        productData,
        _newLocalImagePaths,
        _existingImages,
      );
    }

    if (mounted) {
      if (success) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(widget.product == null ? 'Đã thêm sản phẩm thành công!' : 'Đã cập nhật sản phẩm thành công!'),
            backgroundColor: Colors.green,
          ),
        );
        Navigator.pop(context);
      } else {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(provider.error ?? 'Đã xảy ra lỗi, vui lòng thử lại.'),
            backgroundColor: Colors.red,
          ),
        );
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final isEdit = widget.product != null;
    final providerState = context.watch<ProviderProvider>();

    return Scaffold(
      appBar: AppBar(
        title: Text(isEdit ? 'Chỉnh sửa phục trang' : 'Thêm phục trang mới'),
      ),
      body: _isLoadingCategories
          ? const Center(child: CircularProgressIndicator(color: AppColors.primary))
          : Form(
              key: _formKey,
              child: ListView(
                padding: const EdgeInsets.all(16),
                children: [
                  // Product Name
                  TextFormField(
                    controller: _nameController,
                    decoration: const InputDecoration(
                      labelText: 'Tên phục trang *',
                      hintText: 'Nhập tên Áo Dài...',
                    ),
                    validator: (val) {
                      if (val == null || val.trim().isEmpty) {
                        return 'Vui lòng nhập tên phục trang';
                      }
                      return null;
                    },
                  ),
                  const SizedBox(height: 16),

                  // Category Selector
                  DropdownButtonFormField<String>(
                    value: _selectedCategoryId,
                    decoration: const InputDecoration(labelText: 'Danh mục *'),
                    items: _categories.map((cat) {
                      return DropdownMenuItem(value: cat.id, child: Text(cat.name));
                    }).toList(),
                    onChanged: (val) {
                      setState(() {
                        _selectedCategoryId = val;
                      });
                    },
                  ),
                  const SizedBox(height: 16),


                  // Pricing Rows
                  Row(
                    children: [
                      Expanded(
                        child: TextFormField(
                          controller: _priceController,
                          keyboardType: TextInputType.number,
                          decoration: const InputDecoration(
                            labelText: 'Giá thuê / ngày *',
                            suffixText: 'đ',
                          ),
                          validator: (val) {
                            if (val == null || val.trim().isEmpty) {
                              return 'Vui lòng nhập giá';
                            }
                            if (double.tryParse(val.trim()) == null) {
                              return 'Giá không hợp lệ';
                            }
                            return null;
                          },
                        ),
                      ),
                      const SizedBox(width: 16),
                      Expanded(
                        child: TextFormField(
                          controller: _depositController,
                          keyboardType: TextInputType.number,
                          decoration: const InputDecoration(
                            labelText: 'Tiền đặt cọc *',
                            suffixText: 'đ',
                          ),
                          validator: (val) {
                            if (val == null || val.trim().isEmpty) {
                              return 'Vui lòng nhập tiền cọc';
                            }
                            final deposit = double.tryParse(val.trim());
                            if (deposit == null) {
                              return 'Tiền cọc không hợp lệ';
                            }
                            final price = double.tryParse(_priceController.text.trim());
                            if (price != null && deposit >= price) {
                              return 'Tiền cọc phải bé hơn giá thuê';
                            }
                            return null;
                          },



                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 16),

                  // Description
                  TextFormField(
                    controller: _descriptionController,
                    maxLines: 3,
                    decoration: const InputDecoration(
                      labelText: 'Mô tả phục trang',
                      hintText: 'Nhập chi tiết thông tin phục trang...',
                    ),
                  ),
                  const SizedBox(height: 20),

                  // Sizes selection
                  const Text('Chọn Kích cỡ sẵn có (Sizes) *', style: TextStyle(fontWeight: FontWeight.bold)),
                  const SizedBox(height: 8),
                  Wrap(
                    spacing: 8,
                    children: _allSizes.map((size) {
                      final isSelected = _selectedSizes.contains(size);
                      return FilterChip(
                        label: Text(size),
                        selected: isSelected,
                        selectedColor: AppColors.primaryTrans,
                        checkmarkColor: AppColors.primary,
                        labelStyle: TextStyle(
                          color: isSelected ? AppColors.primary : AppColors.textSecondary,
                          fontWeight: isSelected ? FontWeight.bold : FontWeight.normal,
                        ),
                        onSelected: (selected) {
                          setState(() {
                            if (selected) {
                              _selectedSizes.add(size);
                            } else {
                              _selectedSizes.remove(size);
                            }
                          });
                        },
                      );
                    }).toList(),
                  ),
                  const SizedBox(height: 20),

                  // Images management
                  const Text('Hình ảnh phục trang *', style: TextStyle(fontWeight: FontWeight.bold)),
                  const SizedBox(height: 8),
                  GridView.builder(
                    shrinkWrap: true,
                    physics: const NeverScrollableScrollPhysics(),
                    gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
                      crossAxisCount: 3,
                      crossAxisSpacing: 8,
                      mainAxisSpacing: 8,
                    ),
                    itemCount: _existingImages.length + _newLocalImagePaths.length + 1,
                    itemBuilder: (context, index) {
                      if (index == _existingImages.length + _newLocalImagePaths.length) {
                        // Pick Image Button
                        return InkWell(
                          onTap: _pickImage,
                          child: Container(
                            decoration: BoxDecoration(
                              border: Border.all(color: AppColors.textSecondary.withOpacity(0.4), width: 1.5),
                              borderRadius: BorderRadius.circular(8),
                            ),
                            child: const Icon(Icons.add_a_photo, color: AppColors.primary, size: 28),
                          ),
                        );
                      }

                      final isExisting = index < _existingImages.length;
                      final imagePath = isExisting
                          ? _existingImages[index]
                          : _newLocalImagePaths[index - _existingImages.length];

                      return Stack(
                        fit: StackFit.expand,
                        children: [
                          Container(
                            decoration: BoxDecoration(
                              borderRadius: BorderRadius.circular(8),
                              border: Border.all(color: Colors.grey.shade300),
                            ),
                            clipBehavior: Clip.antiAlias,
                            child: isExisting
                                ? Image.network(imagePath, fit: BoxFit.cover)
                                : Image.file(File(imagePath), fit: BoxFit.cover),
                          ),
                          Positioned(
                            top: 4,
                            right: 4,
                            child: GestureDetector(
                              onTap: () {
                                if (isExisting) {
                                  _removeExistingImage(index);
                                } else {
                                  _removeNewImage(index - _existingImages.length);
                                }
                              },
                              child: Container(
                                padding: const EdgeInsets.all(2),
                                decoration: const BoxDecoration(
                                  color: Colors.black54,
                                  shape: BoxShape.circle,
                                ),
                                child: const Icon(Icons.close, color: Colors.white, size: 16),
                              ),
                            ),
                          ),
                        ],
                      );
                    },
                  ),
                  const SizedBox(height: 32),

                  // Submit Button
                  ElevatedButton(
                    onPressed: providerState.isLoading ? null : _submit,
                    style: ElevatedButton.styleFrom(
                      padding: const EdgeInsets.symmetric(vertical: 16),
                    ),
                    child: providerState.isLoading
                        ? const SizedBox(
                            width: 20,
                            height: 20,
                            child: CircularProgressIndicator(color: Colors.white, strokeWidth: 2),
                          )
                        : Text(isEdit ? 'LƯU THAY ĐỔI' : 'ĐĂNG PHỤC TRANG'),
                  ),
                ],
              ),
            ),
    );
  }
}
