function addNumbers(num1, num2) {
    return num1 + num2;
}

describe('add numbers', () => {
    it('adds two numbers', () => {
        expect(addNumbers(5,10)).toEqual(15)
    });
})