"use server";

import { Cart, CartItem } from "@/types";
import { cookies } from "next/headers";
import { convertToPlainObject, formatError, round2 } from "../utils";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { cartItemSchema, insertCartSchema } from "../validators";
import { revalidatePath } from "next/cache";
import { Prisma } from "../generated/prisma/client";

//calculate cart prices
const calcPrice = (items: CartItem[]) => {
  const itemsPrice = round2(
      items.reduce((acc, item) => acc + Number(item.price) * item.qty, 0)
    ),
    shippingPrice = round2(itemsPrice > 100 ? 0 : 10),
    taxPrice = round2(0.15 * itemsPrice),
    totalPrice = round2(itemsPrice + shippingPrice + taxPrice);

  return {
    itemsPrice: itemsPrice.toFixed(2),
    shippingPrice: shippingPrice.toFixed(2),
    taxPrice: taxPrice.toFixed(2),
    totalPrice: totalPrice.toFixed(2),
  };
};

export async function addItemToCart(data: CartItem) {
  try {
    //check for cart cookie
    const sessionCartId = (await cookies()).get("sessionCartId")?.value;

    if (!sessionCartId) {
      throw new Error("Cart session not found");
    }

    //get session and user id
    const session = await auth();
    const userId = session?.user?.id ? (session.user.id as string) : undefined;

    //get cart
    const cart = await getMyCart();

    //parse and validate items
    const item = cartItemSchema.parse(data);

    //find product in db
    const product = await prisma.product.findFirst({
      where: { id: item.productId },
    });

    if (!product) throw new Error("Product not found");

    //check if nothing is in cart
    if (!cart) {
      //create new cart
      const newCart = insertCartSchema.parse({
        userId: userId,
        sessionCartId: sessionCartId,
        items: [item],
        ...calcPrice([item]),
      });

      //add to database
      await prisma.cart.create({
        data: newCart,
      });

      //revalidate product page
      revalidatePath(`/product/${product.slug}`);

      return {
        success: true,
        message: `${product.name} added to cart`,
      };
    } else {
      //check if item exists in cart
      const existItem = (cart.items as CartItem[]).find(
        (x) => x.productId === item.productId
      );

      if (existItem) {
        //check stock
        if (product.stock < existItem.qty + 1) {
          throw new Error("Not enough stock available");
        }
        //update qty
        (cart.items as CartItem[]).find(
          (x) => x.productId === item.productId
        )!.qty = existItem.qty + 1;
      } else {
        //if item does not exist in cart
        //check stock
        if (product.stock < 1) {
          throw new Error("Not enough stock available");
        }
        //add item to cart.items
        cart.items.push(item);
      }

      //save to db
      await prisma.cart.update({
        where: { id: cart.id },
        data: {
          items: cart.items as Prisma.CartUpdateitemsInput[],
          ...calcPrice(cart.items as CartItem[]),
        },
      });

      revalidatePath(`/product/${product.slug}`);

      return {
        success: true,
        message: `${product.name} ${
          existItem ? "updated in" : "added to"
        } cart`,
      };
    }
  } catch (error) {
    return {
      success: false,
      message: formatError(error),
    };
  }
}

export async function getMyCart() {
  //check for cart cookie
  const sessionCartId = (await cookies()).get("sessionCartId")?.value;

  if (!sessionCartId) {
    throw new Error("Cart session not found");
  }

  //get session and user id
  const session = await auth();
  const userId = session?.user?.id ? (session.user.id as string) : undefined;

  //get user cart from database
  const cart = await prisma.cart.findFirst({
    where: userId ? { userId: userId } : { sessionCartId: sessionCartId },
  });

  if (!cart) return undefined;

  //convert decimals and return
  return convertToPlainObject({
    ...cart,
    items: cart.items as CartItem[],
    itemsPrice: cart.itemsPrice.toString(),
    taxPrice: cart.taxPrice.toString(),
    shippingPrice: cart.shippingPrice.toString(),
    totalPrice: cart.totalPrice.toString(),
  });
}

export async function removeItemFromCart(productId: string) {
  try {
    //check for cart cookie
    const sessionCartId = (await cookies()).get("sessionCartId")?.value;

    if (!sessionCartId) {
      throw new Error("Cart session not found");
    }

    //get product
    const product = await prisma.product.findFirst({
      where: { id: productId },
    });

    if (!product) {
      throw new Error("Product not found");
    }

    //get user cart
    const cart = await getMyCart();
    if (!cart) throw new Error("Cart not found");

    //check if cart has item
    const existItem = (cart.items as CartItem[]).find(
      (x) => x.productId === productId
    );

    if (!existItem) throw new Error("Item not found in cart");

    //check if only 1 item in cart
    if (existItem.qty === 1) {
      //remove from cart
      cart.items = (cart.items as CartItem[]).filter(
        (x) => x.productId !== existItem.productId
      );
    } else {
      //decrease qty
      (cart.items as CartItem[]).find((x) => x.productId === productId)!.qty =
        existItem.qty - 1;
    }

    //update cart in db
    await prisma.cart.update({
      where: { id: cart.id },
      data: {
        items: cart.items as Prisma.CartUpdateitemsInput[],
        ...calcPrice(cart.items as CartItem[]),
      },
    });

    revalidatePath(`/product/${product.slug}`);

    return {
      success: true,
      message: `${product.name} was removed from cart`,
    };
  } catch (error) {
    return {
      success: false,
      message: formatError(error),
    };
  }
}
