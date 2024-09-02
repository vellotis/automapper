import { classes } from '@automapper/classes';
import {
  addProfile,
  afterMap,
  beforeMap,
  createMap,
  createMapper,
  forMember, fromValue,
  ignore, mapDefer
} from '@automapper/core';
import { SimpleUserDto } from './dtos/simple-user.dto';
import { SimpleUser } from './models/simple-user';
import { getUser } from './utils/get-user';

async function asyncResolve<T>(value: T, delayMs = 1000): Promise<T> {
    return new Promise((resolve) => {
        setTimeout(() => {
            resolve(value);
        }, delayMs);
    });
}

const getFullname = (user: SimpleUser) => user.firstName + ' ' + user.lastName;

describe('Map Async Classes', () => {
    const mapper = createMapper({ strategyInitializer: classes() });

    it('should map async', async () => {
        createMap(
            mapper,
            SimpleUser,
            SimpleUserDto,
            forMember((d) => d.fullName, ignore()),
            beforeMap(async (source) => {
                source.firstName = await asyncResolve(source.firstName);
            }),
            afterMap(async (source, destination) => {
                const fullName = await asyncResolve(getFullname(source));

                Object.assign(destination, { fullName });
            })
        );

        const user = new SimpleUser('Chau', 'Tran');

        const dto = await mapper.mapAsync(
            user,
            SimpleUser,
            SimpleUserDto
        );
        expect(dto.fullName).toEqual(user.firstName + ' ' + user.lastName);
    });

    it('should map array async without calling afterMap', async () => {
      createMap(
          mapper,
          SimpleUser,
          SimpleUserDto,
          forMember((d) => d.fullName, ignore()),
          afterMap(async (source, destination) => {
              const fullName = await asyncResolve(getFullname(source));

              Object.assign(destination, { fullName });
          })
      );

      const user = new SimpleUser('Chau', 'Tran');

      const dtos = await mapper.mapArrayAsync(
          [user],
          SimpleUser,
          SimpleUserDto
      );

      expect(dtos).toHaveLength(1);
      expect(dtos[0].firstName).toEqual(user.firstName);
      expect(dtos[0].lastName).toEqual(user.lastName);
      expect(dtos[0].fullName).toEqual(undefined); // afterMap is not called
  });



  it('should resolve defer if Promise returned from the mapping', async () => {
      class Source {}
      class Destination {
          value!: string;
      }
      const mockValue = 'mockValue';
      addProfile(mapper, function failingProfile(mapper) {
          createMap(mapper, Source, Destination,
              forMember((d) => d.value, mapDefer(() => Promise.resolve(fromValue(mockValue)))),
          )
      });

      const destination = await mapper.mapAsync({}, Source, Destination);

      expect(destination.value).toEqual(mockValue);
  });
});
