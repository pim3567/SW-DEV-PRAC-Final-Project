const Massage = require('../models/MassageShop');
const { createShop, updateShop } = require('../controllers/shops');

const makeResponse = () => ({
    status: jest.fn().mockReturnThis(),
    json: jest.fn().mockReturnThis()
});

afterEach(() => jest.restoreAllMocks());

test('successful shop updates respond with the updated shop', async () => {
    const shop = { _id: '507f1f77bcf86cd799439011', name: 'Updated Shop' };
    jest.spyOn(Massage, 'findByIdAndUpdate').mockResolvedValue(shop);
    const res = makeResponse();

    await updateShop({ params: { id: shop._id }, body: { name: shop.name } }, res);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({ success: true, data: shop });
});

test('shop creation returns a JSON validation error for a missing name', async () => {
    const error = await new Massage({
        address: 'Bangkok', tel: '0812345678', openingTime: '09:00', closingTime: '21:00'
    }).validate().catch(err => err);
    jest.spyOn(Massage, 'create').mockRejectedValue(error);
    const res = makeResponse();

    await createShop({ body: { openingTime: '09:00', closingTime: '21:00' } }, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ success: false, error: error.message });
});
