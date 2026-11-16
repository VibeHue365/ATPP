import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Types } from 'mongoose';
import { HeritageSpotsService } from './heritage-spots.service';
import {
  HeritageSpot,
  HeritageSpotSpaceType,
} from '../schemas/heritage-spot.schema';
import { HUE_HERITAGE_SPOTS_SEED } from '../data/heritage-spots.seed';

describe('HeritageSpotsService', () => {
  let service: HeritageSpotsService;
  let mockHeritageSpotModel: any;

  const mockSpotOutdoor = {
    _id: new Types.ObjectId('6730a1b2c3d4e5f6a7b8c901'),
    name: 'Đại Nội Huế - Ngọ Môn & Điện Thái Hòa',
    slug: 'dai-noi-hue',
    spaceType: HeritageSpotSpaceType.OUTDOOR,
    baseTravelFee: 0,
    isActive: true,
  };

  const mockSpotSemiIndoor = {
    _id: new Types.ObjectId('6730a1b2c3d4e5f6a7b8c902'),
    name: 'Cung An Định',
    slug: 'cung-an-dinh',
    spaceType: HeritageSpotSpaceType.SEMI_INDOOR,
    baseTravelFee: 20000,
    isActive: true,
  };

  const mockSpotDistant = {
    _id: new Types.ObjectId('6730a1b2c3d4e5f6a7b8c903'),
    name: 'Lăng Minh Mạng',
    slug: 'lang-minh-mang',
    spaceType: HeritageSpotSpaceType.OUTDOOR,
    baseTravelFee: 120000,
    isActive: true,
  };

  beforeEach(async () => {
    mockHeritageSpotModel = {
      countDocuments: jest.fn(),
      updateOne: jest.fn(),
      find: jest.fn(),
      findById: jest.fn(),
      findOne: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        HeritageSpotsService,
        {
          provide: getModelToken(HeritageSpot.name),
          useValue: mockHeritageSpotModel,
        },
      ],
    }).compile();

    service = module.get<HeritageSpotsService>(HeritageSpotsService);
  });

  describe('seedInitialSpots', () => {
    it('nên tự động nạp 10 di tích Huế nếu collection rỗng (count = 0)', async () => {
      mockHeritageSpotModel.countDocuments.mockResolvedValue(0);
      mockHeritageSpotModel.updateOne.mockResolvedValue({ acknowledged: true });

      const seededCount = await service.seedInitialSpots();

      expect(mockHeritageSpotModel.countDocuments).toHaveBeenCalled();
      expect(mockHeritageSpotModel.updateOne).toHaveBeenCalledTimes(HUE_HERITAGE_SPOTS_SEED.length);
      expect(seededCount).toBe(10);
    });

    it('không nạp lại nếu collection đã có dữ liệu', async () => {
      mockHeritageSpotModel.countDocuments.mockResolvedValue(10);

      const count = await service.seedInitialSpots();

      expect(mockHeritageSpotModel.updateOne).not.toHaveBeenCalled();
      expect(count).toBe(10);
    });
  });

  describe('findAll', () => {
    it('nên tìm kiếm với chỉ mục địa không gian $near khi có tọa độ lat, lng', async () => {
      const execMock = jest.fn().mockResolvedValue([mockSpotOutdoor, mockSpotSemiIndoor]);
      const leanMock = jest.fn().mockReturnValue({ exec: execMock });
      mockHeritageSpotModel.find.mockReturnValue({ lean: leanMock });

      const result = await service.findAll({
        lat: 16.4637,
        lng: 107.5909,
        radiusKm: 10,
        spaceType: HeritageSpotSpaceType.OUTDOOR,
      });

      expect(mockHeritageSpotModel.find).toHaveBeenCalledWith(
        expect.objectContaining({
          isActive: true,
          spaceType: HeritageSpotSpaceType.OUTDOOR,
          location: {
            $near: {
              $geometry: {
                type: 'Point',
                coordinates: [107.5909, 16.4637],
              },
              $maxDistance: 10000,
            },
          },
        }),
      );
      expect(result).toHaveLength(2);
    });

    it('nên sắp xếp theo tên khi không truyền tọa độ GPS', async () => {
      const execMock = jest.fn().mockResolvedValue([mockSpotSemiIndoor, mockSpotOutdoor]);
      const leanMock = jest.fn().mockReturnValue({ exec: execMock });
      const sortMock = jest.fn().mockReturnValue({ lean: leanMock });
      mockHeritageSpotModel.find.mockReturnValue({ sort: sortMock });

      const result = await service.findAll({});

      expect(sortMock).toHaveBeenCalledWith({ name: 1 });
      expect(result).toHaveLength(2);
    });
  });

  describe('findById & findBySlug', () => {
    it('ném lỗi BadRequestException nếu id không hợp lệ', async () => {
      await expect(service.findById('invalid-id')).rejects.toThrow(BadRequestException);
    });

    it('ném lỗi NotFoundException nếu không tìm thấy di tích', async () => {
      const validId = new Types.ObjectId().toString();
      mockHeritageSpotModel.findById.mockReturnValue({
        exec: jest.fn().mockResolvedValue(null),
      });

      await expect(service.findById(validId)).rejects.toThrow(NotFoundException);
    });

    it('trả về di tích nếu tìm thấy theo slug', async () => {
      mockHeritageSpotModel.findOne.mockReturnValue({
        exec: jest.fn().mockResolvedValue(mockSpotOutdoor),
      });

      const spot = await service.findBySlug('dai-noi-hue');
      expect(spot).toEqual(mockSpotOutdoor);
    });
  });

  describe('calculateTravelFeeDelta (Tuân thủ Quyết định AD-01)', () => {
    it('AD-01: Điểm mới gần hơn điểm cũ (new < old) -> additionalFeeDue = 0 (Không hoàn tiền âm)', async () => {
      // Đổi từ Lăng Minh Mạng (120k) sang Cung An Định (20k)
      mockHeritageSpotModel.findById.mockImplementation((id: string) => {
        if (id === mockSpotDistant._id.toString()) {
          return { select: jest.fn().mockReturnValue({ lean: jest.fn().mockResolvedValue({ baseTravelFee: 120000 }) }) };
        }
        if (id === mockSpotSemiIndoor._id.toString()) {
          return { select: jest.fn().mockReturnValue({ lean: jest.fn().mockResolvedValue({ baseTravelFee: 20000 }) }) };
        }
        return { select: jest.fn().mockReturnValue({ lean: jest.fn().mockResolvedValue(null) }) };
      });

      const delta = await service.calculateTravelFeeDelta(
        mockSpotDistant._id.toString(),
        mockSpotSemiIndoor._id.toString(),
      );

      expect(delta.oldTravelFee).toBe(120000);
      expect(delta.newTravelFee).toBe(20000);
      expect(delta.rawFeeDelta).toBe(-100000); // 20k - 120k = -100k
      expect(delta.additionalFeeDue).toBe(0); // AD-01: Không âm, trả về 0!
    });

    it('AD-01: Điểm mới xa hơn điểm cũ (new > old) -> additionalFeeDue = chênh lệch dương', async () => {
      // Đổi từ Đại Nội (0k) sang Lăng Minh Mạng (120k)
      mockHeritageSpotModel.findById.mockImplementation((id: string) => {
        if (id === mockSpotOutdoor._id.toString()) {
          return { select: jest.fn().mockReturnValue({ lean: jest.fn().mockResolvedValue({ baseTravelFee: 0 }) }) };
        }
        if (id === mockSpotDistant._id.toString()) {
          return { select: jest.fn().mockReturnValue({ lean: jest.fn().mockResolvedValue({ baseTravelFee: 120000 }) }) };
        }
        return { select: jest.fn().mockReturnValue({ lean: jest.fn().mockResolvedValue(null) }) };
      });

      const delta = await service.calculateTravelFeeDelta(
        mockSpotOutdoor._id.toString(),
        mockSpotDistant._id.toString(),
      );

      expect(delta.oldTravelFee).toBe(0);
      expect(delta.newTravelFee).toBe(120000);
      expect(delta.rawFeeDelta).toBe(120000);
      expect(delta.additionalFeeDue).toBe(120000); // Khách phải trả thêm 120k
    });

    it('AD-01: Cùng mức phí di chuyển -> additionalFeeDue = 0', async () => {
      mockHeritageSpotModel.findById.mockImplementation(() => {
        return { select: jest.fn().mockReturnValue({ lean: jest.fn().mockResolvedValue({ baseTravelFee: 50000 }) }) };
      });

      const delta = await service.calculateTravelFeeDelta(
        new Types.ObjectId().toString(),
        new Types.ObjectId().toString(),
      );

      expect(delta.rawFeeDelta).toBe(0);
      expect(delta.additionalFeeDue).toBe(0);
    });
  });
});
