import { inject, injectable } from 'tsyringe';

import AppError from '@shared/errors/AppError';

import IProductsRepository from '@modules/products/repositories/IProductsRepository';
import ICustomersRepository from '@modules/customers/repositories/ICustomersRepository';
import Order from '../infra/typeorm/entities/Order';
import IOrdersRepository from '../repositories/IOrdersRepository';

interface IProduct {
  id: string;
  quantity: number;
}

interface IRequest {
  customer_id: string;
  products: IProduct[];
}

@injectable()
class CreateOrderService {
  constructor(
    @inject('OrdersRepository')
    private ordersRepository: IOrdersRepository,
    @inject('ProductsRepository')
    private productsRepository: IProductsRepository,
    @inject('CustomersRepository')
    private customersRepository: ICustomersRepository,
  ) {}

  public async execute({ customer_id, products }: IRequest): Promise<Order> {
    const customer = await this.customersRepository.findById(customer_id);

    if (!customer) {
      throw new AppError('Customer not found');
    }

    const existentProducts = await this.productsRepository.findAllById(
      products,
    );

    if (!existentProducts) {
      throw new AppError('Cannot find products with given ids');
    }

    const existendProductsIds = existentProducts.map(product => product.id);

    const checkInexistentProducts = products.filter(
      product => !existendProductsIds.includes(product.id),
    );

    if (checkInexistentProducts.length) {
      throw new AppError(
        `Could not find product ${checkInexistentProducts[0].id}`,
      );
    }

    const findProductsWithNoQuantityAvailable = products.filter(
      product =>
        existentProducts.filter(p => p.id === product.id)[0].quantity <
        product.quantity,
    );

    if (findProductsWithNoQuantityAvailable.length) {
      throw new AppError(
        `Invalid quantity for ${findProductsWithNoQuantityAvailable[0].id}`,
      );
    }

    const formatedProducts = products.map(product => ({
      quantity: product.quantity,
      product_id: product.id,
      price: existentProducts.find(p => p.id === product.id)?.price || 0,
    }));

    const order = await this.ordersRepository.create({
      customer,
      products: formatedProducts,
    });

    const orderedProduct = products.map(product => ({
      id: product.id,
      quantity:
        existentProducts.filter(p => p.id === product.id)[0].quantity -
        product.quantity,
    }));

    await this.productsRepository.updateQuantity(orderedProduct);

    return order;
  }
}

export default CreateOrderService;
