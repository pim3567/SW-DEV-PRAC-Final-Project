const SpecialClosingDate = require('../models/SpecialClosingDate');
const Massage = require('../models/MassageShop');
const {
    createClosingDate, getClosingDates, updateClosingDate, deleteClosingDate
} = require('../controllers/specialClosingDates');

const makeResponse = () => ({
    status: jest.fn().mockReturnThis(),
    json: jest.fn().mockReturnThis()
});

const shopId = '507f1f77bcf86cd799439011';
const closingId = '507f1f77bcf86cd799439012';

afterEach(() => jest.restoreAllMocks());

test('creates a closing date for an existing shop', async () => {
    const doc = { _id: closingId, shopId, date: '2026-12-31', reason: 'Holiday' };
    jest.spyOn(Massage, 'findById').mockResolvedValue({ _id: shopId });
    jest.spyOn(SpecialClosingDate, 'create').mockResolvedValue(doc);
    const res = makeResponse();

    await createClosingDate({ params: { shopId }, body: { date: '2026-12-31', reason: 'Holiday' } }, res);

    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json).toHaveBeenCalledWith({ success: true, data: doc });
});

test('rejects invalid dates on create', async () => {
    const res = makeResponse();
    await createClosingDate({ params: { shopId }, body: { date: '2026-02-30', reason: 'x' } }, res);
    expect(res.status).toHaveBeenCalledWith(400);
});

test('returns 404 when creating for an unknown shop', async () => {
    jest.spyOn(Massage, 'findById').mockResolvedValue(null);
    const res = makeResponse();
    await createClosingDate({ params: { shopId }, body: { date: '2026-12-31', reason: 'x' } }, res);
    expect(res.status).toHaveBeenCalledWith(404);
});

test('duplicate date for a shop returns 400', async () => {
    jest.spyOn(Massage, 'findById').mockResolvedValue({ _id: shopId });
    jest.spyOn(SpecialClosingDate, 'create').mockRejectedValue({ code: 11000 });
    const res = makeResponse();
    await createClosingDate({ params: { shopId }, body: { date: '2026-12-31', reason: 'x' } }, res);
    expect(res.status).toHaveBeenCalledWith(400);
});

test('lists closing dates of a shop', async () => {
    const docs = [{ date: '2026-12-31' }];
    jest.spyOn(Massage, 'findById').mockResolvedValue({ _id: shopId });
    jest.spyOn(SpecialClosingDate, 'find').mockReturnValue({ sort: jest.fn().mockResolvedValue(docs) });
    const res = makeResponse();

    await getClosingDates({ params: { shopId } }, res);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({ success: true, count: 1, data: docs });
});

test('updates a closing date', async () => {
    const doc = { _id: closingId, date: '2026-12-30', reason: 'Training' };
    jest.spyOn(SpecialClosingDate, 'findByIdAndUpdate').mockResolvedValue(doc);
    const res = makeResponse();

    await updateClosingDate({ params: { id: closingId }, body: { reason: 'Training' } }, res);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({ success: true, data: doc });
});

test('update with no fields returns 400 and missing doc returns 404', async () => {
    const res1 = makeResponse();
    await updateClosingDate({ params: { id: closingId }, body: {} }, res1);
    expect(res1.status).toHaveBeenCalledWith(400);

    jest.spyOn(SpecialClosingDate, 'findByIdAndUpdate').mockResolvedValue(null);
    const res2 = makeResponse();
    await updateClosingDate({ params: { id: closingId }, body: { reason: 'x' } }, res2);
    expect(res2.status).toHaveBeenCalledWith(404);
});

test('deletes a closing date and 404s when missing', async () => {
    const spy = jest.spyOn(SpecialClosingDate, 'findByIdAndDelete').mockResolvedValueOnce({ _id: closingId });
    const res1 = makeResponse();
    await deleteClosingDate({ params: { id: closingId } }, res1);
    expect(res1.status).toHaveBeenCalledWith(200);

    spy.mockResolvedValueOnce(null);
    const res2 = makeResponse();
    await deleteClosingDate({ params: { id: closingId } }, res2);
    expect(res2.status).toHaveBeenCalledWith(404);
});
