export class CreateOfferDto {
  price!: string | number;
  currency?: string;
  transitDays?: string | number;
  notes?: string | null;
}
