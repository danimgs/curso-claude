export interface IRestaurantLookup {
    exists(restaurantId: string): Promise<boolean>
}
