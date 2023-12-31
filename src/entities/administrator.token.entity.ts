import {
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from "typeorm";
import { Administrator } from "./administrator.entity";

@Index("fk_administrator_token_administrator_id", ["administratorId"], {})
@Entity("administrator_token", { schema: "altera_ketering" })
export class AdministratorToken {
  @PrimaryGeneratedColumn({
    type: "int",
    name: "administrator_token_id",
    unsigned: true,
  })
  administratorTokenId: number;

  @Column({type:"int",  name: "administrator_id", unsigned: true })
  administratorId: number;

  @Column({type:"text",  name: "token" })
  token: string;

  @Column({
    type:"timestamp", 
    name: "created_at",
    default: () => "CURRENT_TIMESTAMP",
  })
  createdAt: Date;

  @Column({type:"datetime",  name: "expires_at" })
  expiresAt: Date;

  @Column({type:"bit",  name: "is_valid", default: () => "'b'0''" })
  isValid: boolean;

  @ManyToOne(
    () => Administrator,
    (administrator) => administrator.administratorTokens,
    { onDelete: "RESTRICT", onUpdate: "CASCADE" }
  )
  @JoinColumn([
    { name: "administrator_id", referencedColumnName: "administratorId" },
  ])
  administrator: Administrator;
}
